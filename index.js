/**
 * Character Status — SillyTavern Extension
 */

import { event_types } from '../../../events.js';

const EXT_NAME = 'st-CharStatus';

const DEFAULT_PROMPT = `현재 롤플레이를 분석해서 {{char}}의 상태를 출력해. 아래 형식 그대로 사용. 모든 텍스트는 반드시 한국어만. 영어 절대 금지.

STATS:heart=숫자|temp=숫자|love=숫자|anger=숫자|conscience=숫자|regret=숫자|status=한국어5자이내|semoji=이모지
NSFW:arousal=숫자|cock=상태|cock_comment=텍스트|reason=텍스트|act2=텍스트|size_diff=텍스트|size_diff_nsfw=텍스트
BODY:heart=텍스트|temp=텍스트
EMO:love=텍스트|anger=텍스트|conscience=텍스트|regret=텍스트
THOUGHT:이모지|메인20자이내|디테일2문장
THOUGHT:이모지|메인20자이내|디테일2문장
MOE_USER:name={{user}}|k1=텍스트|k2=텍스트|k3=텍스트|k4=텍스트|k5=텍스트
MOE_NPC:name=NPC이름|k1=텍스트|k2=텍스트|k3=텍스트|k4=텍스트|k5=텍스트

규칙:
- temp: 반드시 36.0~38.5 사이 숫자만. 절대 40 이상 금지.
- heart: 40~180 사이 숫자만.
- BODY: heart=버럭이, temp=버럭이. 코믹+욕설OK. 30자이내. 한국어만.
- EMO: love=기쁨이, anger=버럭이, conscience=슬픔이, regret=까칠이. 코믹+욕설OK. 30자이내. 한국어만.
- cock상태: 잠잠/슬슬반응👀/반응중/완전무장🚀 중 하나만
- cock_comment: 자지 1인칭. 경험없고소심=수줍음, 경험없고자신만만=근거없는자신감, 경험있음=쿨함, 경험많음=초노골적더티톡. 40자이내. 한국어만.
- act2: 노골적 더티톡 한국어. 40자이내.
- size_diff: 현재상황 신체크기차이 3문장. 귀엽고웃김. 한국어. {{user}}없으면 NONE
- size_diff_nsfw: 성적맥락 크기차이 3문장. 노골적. 한국어. 성적긴장없으면 NONE
- MOE키워드: 이모지포함 8자이내 한국어
- MOE_NPC: NPC있을때만. 없으면 줄 자체 생략
- 모든 필드 반드시 한국어. 영어 절대 금지.`;

const DEFAULTS = {
    enabled: true,
    apiSource: 'main',
    connectionProfileId: '',
    maxTokens: 1000,
    contextMessages: 5,
    prompt: DEFAULT_PROMPT,
};

let settings = {};
let ctx = null;

function save() { ctx.saveSettingsDebounced(); }

function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
}

async function init() {
    console.log(`[${EXT_NAME}] 초기화 시작...`);
    ctx = SillyTavern.getContext();
    if (!ctx.extensionSettings[EXT_NAME]) ctx.extensionSettings[EXT_NAME] = structuredClone(DEFAULTS);
    settings = ctx.extensionSettings[EXT_NAME];
    for (const [k, v] of Object.entries(DEFAULTS)) if (settings[k] === undefined) settings[k] = v;
    await loadSettingsUI();
    initializeEventListeners();
    console.log(`[${EXT_NAME}] 초기화 완료`);
}

async function loadSettingsUI() {
    const html = `<div class="cs_settings"><div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Character Status</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content">
<label class="checkbox_label marginBot5"><input type="checkbox" class="cs_enabled" /><span>활성화</span></label>
<hr/><div class="title_restorable"><b>API 설정</b></div>
<div class="marginBot5"><label>API 소스</label><select class="cs_api_source text_pole wide100p"><option value="main">Main API</option></select></div>
<div class="cs_profile_row marginBot5" style="display:none;"><label>Connection Profile</label><select class="cs_profile_select text_pole wide100p"></select></div>
<div class="marginBot5"><label>최대 응답 토큰 수</label><input type="number" class="cs_max_tokens text_pole wide100p" min="100" max="8000" /></div>
<div class="marginBot5"><label>컨텍스트 메시지 수</label><input type="number" class="cs_context_messages text_pole wide100p" min="1" max="100" /></div>
<hr/><div class="title_restorable"><b>프롬프트</b></div>
<div class="marginBot5"><textarea class="cs_prompt text_pole wide100p" rows="6"></textarea></div>
<div class="flex-container flexGap5"><input type="button" class="cs_prompt_reset menu_button" value="프롬프트 초기화" /><input type="button" class="cs_save menu_button" value="설정 저장" /></div>
</div></div></div>`;

    $('#extensions_settings').append(html);
    const s = $('.cs_settings');
    s.find('.cs_enabled').prop('checked', settings.enabled).on('change', function() { settings.enabled = $(this).prop('checked'); save(); });

    const sourceSelect = s.find('.cs_api_source');
    sourceSelect.empty().append('<option value="main">Main API</option>');
    try {
        const cmrs = ctx.ConnectionManagerRequestService;
        if (cmrs && typeof cmrs.getSupportedProfiles === 'function') {
            const profiles = cmrs.getSupportedProfiles();
            if (Array.isArray(profiles)) profiles.forEach(p => {
                const id = p.id || p.profileId || p.uuid || '';
                const name = p.name || p.profileName || id;
                if (id) sourceSelect.append(`<option value="profile:${id}">${esc(name)}</option>`);
            });
        }
    } catch(e) {}

    const curVal = settings.apiSource === 'profile' && settings.connectionProfileId ? `profile:${settings.connectionProfileId}` : 'main';
    sourceSelect.val(curVal);
    if (settings.apiSource === 'profile') s.find('.cs_profile_row').show();
    sourceSelect.on('change', function() {
        const val = $(this).val();
        if (val === 'main') { settings.apiSource = 'main'; settings.connectionProfileId = ''; s.find('.cs_profile_row').hide(); }
        else { settings.apiSource = 'profile'; settings.connectionProfileId = val.replace('profile:', ''); s.find('.cs_profile_row').show(); }
        save();
    });

    s.find('.cs_max_tokens').val(settings.maxTokens).on('change', function() { settings.maxTokens = Number($(this).val()); save(); });
    s.find('.cs_context_messages').val(settings.contextMessages).on('change', function() { settings.contextMessages = Number($(this).val()); save(); });
    s.find('.cs_prompt').val(settings.prompt).on('change', function() { settings.prompt = $(this).val(); save(); });
    s.find('.cs_prompt_reset').on('click', async function() {
        if (await ctx.Popup.show.confirm('프롬프트를 초기화할까요?', '초기화')) {
            settings.prompt = DEFAULT_PROMPT;
            s.find('.cs_prompt').val(DEFAULT_PROMPT);
            save(); toastr.success('프롬프트 초기화됨');
        }
    });
    s.find('.cs_save').on('click', function() { save(); toastr.success('설정 저장됨'); });
}

function addButtonToMessage(mesEl) {
    if (mesEl.querySelector('.cs_status_btn')) return;
    const btn = document.createElement('div');
    btn.title = '캐릭터 상태창';
    btn.className = 'mes_button cs_status_btn fa-solid fa-heart-pulse interactable';
    btn.tabIndex = 0; btn.setAttribute('role', 'button');
    mesEl.querySelector('.mes_buttons .extraMesButtons')?.prepend(btn);
}

function initializeEventListeners() {
    const tpl = document.querySelector('#message_template');
    if (tpl) {
        const btn = document.createElement('div');
        btn.title = '캐릭터 상태창';
        btn.className = 'mes_button cs_status_btn fa-solid fa-heart-pulse interactable';
        btn.tabIndex = 0; btn.setAttribute('role', 'button');
        tpl.querySelector('.mes_buttons .extraMesButtons')?.prepend(btn);
    }
    document.querySelectorAll('#chat .mes').forEach(addButtonToMessage);
    $(document).on('click', '.cs_status_btn', function() {
        if (!settings.enabled) return;
        const messageEl = $(this).closest('.mes')[0];
        if (!messageEl) return;
        const existing = document.getElementById('cs-block');
        if (existing) { existing.remove(); return; }
        showStatusBlock(messageEl);
    });
    const chatEl = document.getElementById('chat');
    if (chatEl) {
        new MutationObserver(mutations => {
            for (const m of mutations)
                for (const node of m.addedNodes)
                    if (node instanceof HTMLElement && node.classList.contains('mes'))
                        addButtonToMessage(node);
        }).observe(chatEl, { childList: true });
    }
    ctx.eventSource.on(event_types.CHAT_CHANGED, () => {
        document.getElementById('cs-block')?.remove();
        setTimeout(() => document.querySelectorAll('#chat .mes').forEach(addButtonToMessage), 500);
    });
}

function parseResponse(raw) {
    if (!raw) return null;
    const lines = raw.trim().split('\n').map(l => l.trim());
    const result = { stats: {}, nsfw: {}, body: {}, emo: {}, thoughts: [], moeUser: null, moeNpc: null };
    const kv = str => {
        const obj = {};
        str.split('|').forEach(p => { const i = p.indexOf('='); if (i > 0) obj[p.slice(0,i).trim()] = p.slice(i+1).trim(); });
        return obj;
    };
    for (const line of lines) {
        if (line.startsWith('STATS:')) result.stats = kv(line.replace('STATS:', ''));
        else if (line.startsWith('NSFW:')) result.nsfw = kv(line.replace('NSFW:', ''));
        else if (line.startsWith('BODY:')) result.body = kv(line.replace('BODY:', ''));
        else if (line.startsWith('EMO:')) result.emo = kv(line.replace('EMO:', ''));
        else if (line.startsWith('THOUGHT:')) {
            const p = line.replace('THOUGHT:', '').split('|');
            if (p.length >= 3) result.thoughts.push({ emoji: p[0].trim(), main: p[1].trim(), detail: p[2].trim() });
        }
        else if (line.startsWith('MOE_NPC:')) result.moeNpc = kv(line.replace('MOE_NPC:', ''));
        else if (line.startsWith('MOE_USER:')) result.moeUser = kv(line.replace('MOE_USER:', ''));
    }
    return result;
}

function comment(charName, charColor, bgColor, text) {
    return `<div style="display:inline-flex;align-items:center;gap:3px;background:${bgColor};border-radius:6px;padding:3px 7px;">
      <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${charColor};flex-shrink:0;"></span>
      <span style="font-size:14px;color:${charColor};font-style:italic;font-weight:600;">${charName} :</span>
      <span style="font-size:14px;color:${charColor};font-style:italic;"> ${esc(text)}</span>
    </div>`;
}

function statRow(label, value, valueColor, charName, charColor, bgColor, commentText, isLast) {
    return `<div style="padding:5px 0;${isLast?'':'border-bottom:0.5px solid rgba(0,0,0,0.06);'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:16px;color:#333;">${label}</span>
        <span style="font-size:16px;font-weight:600;color:${valueColor};">${esc(value)}</span>
      </div>
      ${comment(charName, charColor, bgColor, commentText)}
    </div>`;
}

function kw(text, bg, color) {
    return `<span style="font-size:15px;background:${bg};border-radius:99px;padding:3px 11px;color:${color};font-weight:500;display:inline-block;margin:2px 0;">${esc(text)}</span>`;
}

function getCharInfo() {
    try { const c = SillyTavern.getContext(); const ch = c.characters?.[c.characterId]; return { name: ch?.name || '캐릭터' }; }
    catch { return { name: '캐릭터' }; }
}

function showStatusBlock(messageEl) {
    const charInfo = getCharInfo();
    const block = document.createElement('div');
    block.id = 'cs-block';
    block.style.cssText = 'margin:12px 0 6px;border-radius:14px;overflow:hidden;background:#f9f9f9;border:1px solid rgba(0,0,0,0.1);font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo",sans-serif;';
    block.innerHTML = `<div style="padding:10px 14px;">
      <div style="font-size:18px;font-weight:600;color:#1a1a1a;margin-bottom:4px;">${esc(charInfo.name)}</div>
      <div style="display:flex;align-items:center;gap:8px;font-size:15px;color:#aaa;">
        <div style="display:flex;gap:4px;">
          <span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite;"></span>
          <span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .2s;"></span>
          <span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .4s;"></span>
        </div>상태 분석 중...
      </div>
    </div>`;
    const mesText = messageEl.querySelector('.mes_text');
    if (mesText) { mesText.appendChild(block); block.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    generateStatus(block, charInfo);
}

function renderBlock(block, charInfo, data) {
    const S = data.stats, N = data.nsfw, B = data.body, E = data.emo;
    const sizeDiff = N.size_diff && N.size_diff !== 'NONE' ? N.size_diff : null;
    const sizeDiffNsfw = N.size_diff_nsfw && N.size_diff_nsfw !== 'NONE' ? N.size_diff_nsfw : null;
    const shownSize = sizeDiffNsfw || sizeDiff;

    block.innerHTML = `
    <!-- 헤더 -->
    <div style="padding:10px 14px 8px;border-bottom:1px solid rgba(0,0,0,0.06);">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px;">
        <div style="width:36px;height:36px;background:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:19px;border:1px solid rgba(0,0,0,0.08);">${esc(S.semoji||'🙂')}</div>
        <div>
          <div style="font-size:18px;font-weight:600;color:#1a1a1a;">${esc(charInfo.name)}</div>
          <div style="font-size:15px;color:#999;margin-top:1px;">${esc(S.status||'평온함')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px;">
        <div>
          ${statRow('💗 심박수', `${S.heart||'--'} bpm`, '#E24B4A', '버럭이', '#c0392b', '#fdecea', B.heart||'...', false)}
          ${statRow('🌡️ 체온', `${S.temp||'--'}°C`, '#EF9F27', '버럭이', '#c0392b', '#fdecea', B.temp||'...', false)}
          ${statRow('❤️ 애정', `${S.love||'--'}`, '#D4537E', '기쁨이', '#b7950b', '#fffde7', E.love||'...', true)}
        </div>
        <div>
          ${statRow('😤 분노', `${S.anger||'--'}`, '#E24B4A', '버럭이', '#c0392b', '#fdecea', E.anger||'...', false)}
          ${statRow('😇 양심', `${S.conscience||'--'}`, '#888780', '슬픔이', '#1a6fa8', '#eaf4fb', E.conscience||'...', false)}
          ${statRow('🫠 후회', `${S.regret||'--'}`, '#9B8FD4', '까칠이', '#6b7280', '#f3f0f9', E.regret||'...', true)}
        </div>
      </div>
    </div>

    <!-- 은밀한 상태 -->
    <div style="background:#fff5f7;padding:8px 14px;border-bottom:1px solid rgba(212,83,126,0.15);">
      <div style="font-size:13px;font-weight:700;color:#993556;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px;">🍑 은밀한 상태</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px;">
        <div style="background:#fff;border-radius:8px;padding:6px 9px;border:0.5px solid rgba(212,83,126,0.2);">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="font-size:16px;color:#333;">🌶️ 흥분도</span><span style="font-size:16px;font-weight:600;color:#D4537E;">${esc(N.arousal||'0')}</span></div>
          <div style="font-size:14px;color:#aaa;font-style:italic;">🍆: "${esc(N.reason||'...')}"</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:6px 9px;border:0.5px solid rgba(212,83,126,0.2);">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;"><span style="font-size:16px;color:#333;">🍆 남자의 자존심</span><span style="font-size:16px;font-weight:600;color:#993556;">${esc(N.cock||'잠잠')}</span></div>
          <div style="font-size:14px;color:#aaa;font-style:italic;">🍆: "${esc(N.cock_comment||'...')}"</div>
        </div>
      </div>
      ${N.act2 ? `<div style="background:#993556;border-radius:8px;padding:7px 10px;font-size:16px;color:#fff;line-height:1.4;margin-bottom:5px;">💥 ${esc(N.act2)}</div>` : ''}
      ${shownSize ? `<div style="background:#fff;border-radius:8px;padding:7px 10px;border:0.5px solid rgba(212,83,126,0.2);">
        <div style="font-size:13px;font-weight:700;color:#993556;margin-bottom:3px;">🫧 우리 사이 스케일</div>
        <div style="font-size:15px;color:#555;line-height:1.6;">${esc(shownSize)}</div>
      </div>` : ''}
    </div>

    <!-- 속마음 -->
    <div style="padding:8px 14px;border-bottom:1px solid rgba(0,0,0,0.06);">
      <div style="font-size:13px;font-weight:700;color:#bbb;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px;">🔒 진짜 속마음</div>
      ${data.thoughts.slice(0,2).map((t,i) => `
        <div style="display:flex;gap:8px;padding:4px 0;${i===0?'border-bottom:0.5px solid rgba(0,0,0,0.06);':''}">
          <span style="font-size:19px;flex-shrink:0;">${esc(t.emoji)}</span>
          <div>
            <div style="font-size:16px;font-weight:600;color:#1a1a1a;line-height:1.3;">${esc(t.main)}</div>
            <div style="font-size:15px;color:#999;margin-top:2px;line-height:1.5;">${esc(t.detail)}</div>
          </div>
        </div>`).join('')}
    </div>

    <!-- 지금 이 상태 -->
    <div style="background:#f0f7ff;padding:8px 14px;">
      ${data.moeUser ? `
        <div style="font-size:13px;font-weight:700;color:#2563EB;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px;">🫧 ${esc(data.moeUser.name||'유저')}한테</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;${data.moeNpc?'margin-bottom:8px;':''}">
          ${['k1','k2','k3','k4','k5'].filter(k=>data.moeUser[k]).map(k=>kw(data.moeUser[k],'#dbeafe','#1d4ed8')).join('')}
        </div>` : ''}
      ${data.moeNpc ? `
        <div style="font-size:13px;font-weight:700;color:#E74C3C;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:5px;">😤 ${esc(data.moeNpc.name||'NPC')}한테</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          ${['k1','k2','k3','k4','k5'].filter(k=>data.moeNpc[k]).map(k=>kw(data.moeNpc[k],'#fef2f2','#991B1B')).join('')}
        </div>` : ''}
    </div>

    <div style="padding:6px 14px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(0,0,0,0.06);">
      <span style="font-size:14px;color:#bbb;">🫧 무덤까지 갑니다</span>
      <div style="display:flex;gap:4px;">
        <button id="cs-regen-btn" style="font-size:14px;padding:3px 10px;border-radius:99px;border:0.5px solid rgba(0,0,0,0.15);background:transparent;color:#888;cursor:pointer;">🔄 다시 읽기</button>
        <button id="cs-close-btn" style="font-size:14px;padding:3px 10px;border-radius:99px;border:0.5px solid rgba(0,0,0,0.15);background:transparent;color:#888;cursor:pointer;">✕</button>
      </div>
    </div>`;

    block.querySelector('#cs-regen-btn')?.addEventListener('click', () => {
        const ci = getCharInfo();
        block.innerHTML = `<div style="padding:10px 14px;font-size:15px;color:#aaa;display:flex;align-items:center;gap:8px;"><div style="display:flex;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .2s;"></span><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .4s;"></span></div>다시 읽는 중...</div>`;
        generateStatus(block, ci);
    });
    block.querySelector('#cs-close-btn')?.addEventListener('click', () => block.remove());
}

async function generateStatus(block, charInfo) {
    try {
        const n = settings.contextMessages || 5;
        const recentMsgs = ctx.chat.slice(-n).map(m => `${m.is_user?(m.name||'User'):(m.name||'Char')}: ${m.mes}`).join('\n');
        const systemPrompt = `You are analyzing roleplay for ${charInfo.name}. Output MUST be in Korean only. No English anywhere.`;
        const userPrompt = (ctx.substituteParams ? ctx.substituteParams(settings.prompt) : settings.prompt) + `\n\n=== 최근 대화 ===\n${recentMsgs}`;
        const { generateRaw } = ctx;
        if (!generateRaw) throw new Error('generateRaw를 사용할 수 없습니다.');
        const raw = await generateRaw({ systemPrompt, prompt: userPrompt, streaming: false });
        const data = parseResponse(raw);
        if (!data) throw new Error('파싱 실패');
        renderBlock(block, charInfo, data);
        block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
        console.error(`[${EXT_NAME}]`, e);
        toastr.error('상태 생성 실패: ' + e.message);
        block.innerHTML = `<div style="padding:14px;font-size:15px;color:#E24B4A;">❌ 생성 실패: ${esc(e.message)}</div>`;
    }
}

jQuery(async () => { await init(); });
