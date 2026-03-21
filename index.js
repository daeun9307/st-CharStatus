/**
 * Character Status — SillyTavern Extension
 */

import { event_types } from '../../../events.js';

const EXT_NAME = 'st-CharStatus';

const DEFAULT_PROMPT = `Analyze the current roleplay and output {{char}}'s full status. Follow this EXACT format. No extra text.

STATS:heart=NUMBER|horny=NUMBER|stamina=NUMBER|temp=NUMBER|status=Korean5chars|semoji=EMOJI|blush=NUMBER|love=NUMBER|anger=NUMBER|conscience=NUMBER|regret=NUMBER

NSFW:arousal=NUMBER|cock=STATUS|cock_comment=TEXT|reason=TEXT|act1=TEXT|act2=TEXT|eggplant_talk=TEXT|size_diff=TEXT|size_diff_nsfw=TEXT

BODY:heart=TEXT|temp=TEXT|stamina=TEXT|blush=TEXT
EMO:love=TEXT|anger=TEXT|conscience=TEXT|regret=TEXT

THOUGHT:EMOJI|main (max 20 chars)|detail (2 sentences, crude OK)
THOUGHT:EMOJI|main (max 20 chars)|detail (2 sentences, crude OK)

MOE:state1=TEXT|state2=TEXT|state3=TEXT
MOE_USER:name={{user}}|k1=TEXT|k2=TEXT|k3=TEXT|k4=TEXT|k5=TEXT|k6=TEXT|k7=TEXT
MOE_NPC:name=NPC_NAME|k1=TEXT|k2=TEXT|k3=TEXT|k4=TEXT|k5=TEXT|k6=TEXT|k7=TEXT

Rules:
- heart/blush BODY → 불안이(purple), temp/anger → 버럭이(red), stamina/love → 기쁨이(yellow), conscience → 슬픔이(blue), regret → 까칠이(gray)
- BODY/EMO comments: funny, crude, unfiltered, swearing OK, max 30 chars each
- cock STATUS: 잠잠/슬슬반응👀/반응중/완전무장🚀
- cock_comment: cock speaking in 1st person. Virgin+shy=embarrassed. Virgin+confident=cocky despite inexperience. Experienced=nonchalant. Very experienced/slutty=extremely explicit dirty talk. Max 40 chars.
- reason: why aroused, crude OK, max 25 chars
- act1: specific sexual act {{char}} wants, explicit dirty talk style, max 40 chars
- act2: specific position/act, explicit dirty talk style, max 40 chars
- eggplant_talk: what cock would say to {{user}}. Funny+explicit+self-important. Max 60 chars.
- size_diff: 3 sentences on physical size difference based on current pose/situation. Cute/funny. NONE if {{user}} not present.
- size_diff_nsfw: 3 sentences on size difference in explicit sexual context. Very graphic. NONE if no sexual tension/activity.
- THOUGHT: 2 secret thoughts, unfiltered, swearing OK
- MOE keywords: with emoji, max 8 chars each
- MOE_NPC: only if NPC appears. Crude/violent OK. Omit line entirely if no NPC.`;

const DEFAULTS = {
    enabled: true,
    apiSource: 'main',
    connectionProfileId: '',
    maxTokens: 2000,
    contextMessages: 20,
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
    const result = { stats: {}, nsfw: {}, body: {}, emo: {}, thoughts: [], moe: {}, moeUser: null, moeNpc: null };
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
        else if (line.startsWith('MOE:')) result.moe = kv(line.replace('MOE:', ''));
    }
    return result;
}

function dot(color) { return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:3px;vertical-align:middle;"></span>`; }

function statItem(label, value, valueColor, charName, charColor, comment, isLast) {
    return `<div style="padding:4px 0;${isLast?'':'border-bottom:0.5px solid rgba(0,0,0,0.06);'}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;color:#555;">${label}</span>
        <span style="font-size:13px;font-weight:600;color:${valueColor};">${esc(value)}</span>
      </div>
      <div style="font-size:11px;font-style:italic;color:${charColor};margin-top:2px;">${dot(charColor)}<span style="font-weight:600;">${charName} :</span> ${esc(comment)}</div>
    </div>`;
}

function kw(text, bg, color) { return `<span style="font-size:12px;background:${bg};border-radius:99px;padding:3px 9px;color:${color};font-weight:500;">${esc(text)}</span>`; }

function getCharInfo() {
    try { const c = SillyTavern.getContext(); const ch = c.characters?.[c.characterId]; return { name: ch?.name || '캐릭터' }; }
    catch { return { name: '캐릭터' }; }
}

function showStatusBlock(messageEl) {
    const charInfo = getCharInfo();
    const block = document.createElement('div');
    block.id = 'cs-block';
    block.style.cssText = 'margin:12px 0 6px;border-radius:14px;overflow:hidden;background:#f9f9f9;border:1px solid rgba(0,0,0,0.1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    block.innerHTML = `<div style="padding:10px 14px;"><div style="font-size:16px;font-weight:600;color:#111;margin-bottom:4px;">${esc(charInfo.name)}</div><div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#aaa;"><div style="display:flex;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .2s;"></span><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .4s;"></span></div>상태 분석 중...</div></div>`;
    const mesText = messageEl.querySelector('.mes_text');
    if (mesText) { mesText.appendChild(block); block.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    generateStatus(block, charInfo);
}

function renderBlock(block, charInfo, data) {
    const S = data.stats, N = data.nsfw, B = data.body, E = data.emo;
    const sizeDiff = N.size_diff && N.size_diff !== 'NONE' ? N.size_diff : null;
    const sizeDiffNsfw = N.size_diff_nsfw && N.size_diff_nsfw !== 'NONE' ? N.size_diff_nsfw : null;

    block.innerHTML = `
    <div style="padding:10px 14px 8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:16px;font-weight:600;color:#111;">${esc(charInfo.name)}</div>
        <div style="background:#F2F2F7;border-radius:99px;padding:3px 10px;display:inline-flex;align-items:center;gap:4px;">
          <span style="font-size:13px;">${esc(S.semoji||'🙂')}</span>
          <span style="font-size:12px;font-weight:500;color:#3C3489;">${esc(S.status||'평온함')}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px;">
        <div>
          <div style="font-size:10px;font-weight:600;color:#bbb;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;">신체</div>
          ${statItem('💗 심박수', `${S.heart||'--'} bpm`, '#E24B4A', '버럭이', '#E74C3C', B.heart||'...', false)}
          ${statItem('🌡️ 체온', `${S.temp||'--'}°C`, '#EF9F27', '버럭이', '#E74C3C', B.temp||'...', false)}
          ${statItem('💪 스태미나', `${S.stamina||'--'}%`, '#639922', '기쁨이', '#c9a800', B.stamina||'...', false)}
          ${statItem('😳 홍조', `${S.blush||'--'}`, '#ED93B1', '불안이', '#9B59B6', B.blush||'...', true)}
        </div>
        <div>
          <div style="font-size:10px;font-weight:600;color:#bbb;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;">감정</div>
          ${statItem('❤️ 사랑', `${S.love||'--'}`, '#D4537E', '기쁨이', '#c9a800', E.love||'...', false)}
          ${statItem('😤 분노', `${S.anger||'--'}`, '#E24B4A', '버럭이', '#E74C3C', E.anger||'...', false)}
          ${statItem('😇 양심', `${S.conscience||'--'}`, '#888780', '슬픔이', '#3498DB', E.conscience||'...', false)}
          ${statItem('🫠 후회', `${S.regret||'--'}`, '#7F77DD', '까칠이', '#95A5A6', E.regret||'...', true)}
        </div>
      </div>
    </div>

    <div style="height:0.5px;background:rgba(0,0,0,0.08);"></div>

    <div style="background:#fff5f7;padding:8px 14px;">
      <div style="font-size:10px;font-weight:600;color:#993556;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">🍑 은밀한 상태 (열람 금지)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:7px;">
        <div style="background:#fff;border-radius:8px;padding:7px 10px;border:0.5px solid rgba(212,83,126,0.2);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:13px;color:#555;">🌶️ 흥분도</span><span style="font-size:13px;font-weight:600;color:#D4537E;">${esc(N.arousal||'0')}</span>
          </div>
          <div style="font-size:11px;color:#bbb;font-style:italic;">🍆: "${esc(N.reason||'...')}"</div>
        </div>
        <div style="background:#fff;border-radius:8px;padding:7px 10px;border:0.5px solid rgba(212,83,126,0.2);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:13px;color:#555;">🍆 남자의 자존심</span><span style="font-size:13px;font-weight:600;color:#993556;">${esc(N.cock||'잠잠')}</span>
          </div>
          <div style="font-size:11px;color:#bbb;font-style:italic;">🍆: "${esc(N.cock_comment||'...')}"</div>
        </div>
      </div>
      <div style="font-size:10px;font-weight:600;color:#D4537E;margin-bottom:5px;">💭 지금 하고 싶은 것</div>
      ${N.act1 ? `<div style="background:#fff;border-radius:8px;padding:6px 10px;border:0.5px solid rgba(212,83,126,0.2);margin-bottom:4px;font-size:12px;color:#555;line-height:1.5;">🔥 ${esc(N.act1)}</div>` : ''}
      ${N.act2 ? `<div style="background:#993556;border-radius:8px;padding:6px 10px;margin-bottom:6px;font-size:12px;color:rgba(255,255,255,0.95);line-height:1.5;">💥 ${esc(N.act2)}</div>` : ''}
      ${N.eggplant_talk ? `<div style="background:#fff;border-radius:8px;padding:8px 10px;border:0.5px solid rgba(212,83,126,0.25);">
        <div style="font-size:10px;font-weight:600;color:#993556;margin-bottom:4px;">🍆 잠깐, 나도 할 말 있음</div>
        <div style="font-size:12px;color:#333;line-height:1.7;font-style:italic;">"${esc(N.eggplant_talk)}"</div>
      </div>` : ''}
      ${(sizeDiffNsfw||sizeDiff) ? `
        <div style="height:0.5px;background:rgba(212,83,126,0.15);margin:8px 0;"></div>
        <div style="font-size:10px;font-weight:600;color:#993556;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">🫧 우리 사이 스케일</div>
        <div style="background:#fff;border-radius:10px;padding:9px 12px;border:0.5px solid rgba(212,83,126,0.2);">
          <div style="font-size:12px;color:#555;line-height:1.8;">${esc(sizeDiffNsfw||sizeDiff)}</div>
        </div>` : ''}
    </div>

    <div style="height:0.5px;background:rgba(0,0,0,0.08);"></div>

    <div style="padding:8px 14px;">
      <div style="font-size:10px;font-weight:600;color:#bbb;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">🔒 진짜 속마음</div>
      ${data.thoughts.slice(0,2).map((t,i)=>`
        <div style="display:flex;gap:8px;padding:5px 0;${i===0?'border-bottom:0.5px solid rgba(0,0,0,0.07);':''}">
          <span style="font-size:18px;flex-shrink:0;">${esc(t.emoji)}</span>
          <div>
            <div style="font-size:13px;font-weight:500;color:#111;line-height:1.3;">${esc(t.main)}</div>
            <div style="font-size:12px;color:#999;margin-top:2px;line-height:1.4;">${esc(t.detail)}</div>
          </div>
        </div>`).join('')}
    </div>

    <div style="height:0.5px;background:rgba(0,0,0,0.08);"></div>

    <div style="background:#f0f7ff;padding:8px 14px;">
      <div style="font-size:10px;font-weight:600;color:#2563EB;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">🫧 지금 이 상태</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
        ${Object.values(data.moe||{}).map(v=>`<span style="background:#dbeafe;border-radius:99px;padding:2px 9px;font-size:12px;font-weight:600;color:#1d4ed8;">${esc(v)}</span>`).join('')}
      </div>
      ${data.moeUser ? `
        <div style="font-size:11px;font-weight:600;color:#60a5fa;margin-bottom:5px;">💙 ${esc(data.moeUser.name||'유저')}한테</div>
        <div style="background:#fff;border-radius:10px;padding:8px 10px;border:0.5px solid rgba(56,130,220,0.2);${data.moeNpc?'margin-bottom:8px;':''}">
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            ${['k1','k2','k3','k4','k5','k6','k7'].filter(k=>data.moeUser[k]).map(k=>kw(data.moeUser[k],'#dbeafe','#1d4ed8')).join('')}
          </div>
        </div>` : ''}
      ${data.moeNpc ? `
        <div style="font-size:11px;font-weight:600;color:#E74C3C;margin-bottom:5px;">😤 ${esc(data.moeNpc.name||'NPC')}한테</div>
        <div style="background:#fff;border-radius:10px;padding:8px 10px;border:0.5px solid rgba(231,76,60,0.2);">
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            ${['k1','k2','k3','k4','k5','k6','k7'].filter(k=>data.moeNpc[k]).map(k=>kw(data.moeNpc[k],'#fef2f2','#991B1B')).join('')}
          </div>
        </div>` : ''}
    </div>

    <div style="height:0.5px;background:rgba(0,0,0,0.08);"></div>

    <div style="padding:6px 14px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:11px;color:#bbb;">🫧 무덤까지 갑니다</span>
      <div style="display:flex;gap:5px;">
        <button id="cs-regen-btn" style="font-size:12px;padding:3px 10px;border-radius:99px;border:0.5px solid rgba(0,0,0,0.15);background:transparent;color:#333;cursor:pointer;">🔄 다시 읽기</button>
        <button id="cs-close-btn" style="font-size:12px;padding:3px 10px;border-radius:99px;border:0.5px solid rgba(0,0,0,0.15);background:transparent;color:#888;cursor:pointer;">✕</button>
      </div>
    </div>`;

    block.querySelector('#cs-regen-btn')?.addEventListener('click', () => {
        const ci = getCharInfo();
        block.innerHTML = `<div style="padding:10px 14px;font-size:13px;color:#aaa;display:flex;align-items:center;gap:8px;"><div style="display:flex;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite;"></span><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .2s;"></span><span style="width:5px;height:5px;border-radius:50%;background:#ccc;display:inline-block;animation:cs-bounce 1.2s infinite .4s;"></span></div>다시 읽는 중...</div>`;
        generateStatus(block, ci);
    });
    block.querySelector('#cs-close-btn')?.addEventListener('click', () => block.remove());
}

async function generateStatus(block, charInfo) {
    try {
        const n = settings.contextMessages || 20;
        const recentMsgs = ctx.chat.slice(-n).map(m => `${m.is_user?(m.name||'User'):(m.name||'Char')}: ${m.mes}`).join('\n');
        const systemPrompt = `You are generating a character status report for ${charInfo.name}. Follow the format exactly.`;
        const userPrompt = (ctx.substituteParams ? ctx.substituteParams(settings.prompt) : settings.prompt) + `\n\n=== Recent conversation ===\n${recentMsgs}`;
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
        block.innerHTML = `<div style="padding:14px;font-size:13px;color:#E24B4A;">❌ 생성 실패: ${esc(e.message)}</div>`;
    }
}

jQuery(async () => { await init(); });
