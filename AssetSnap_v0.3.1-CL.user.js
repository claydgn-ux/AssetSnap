// ==UserScript==
// @name         AssetSnap · v0.3.1-CL
// @namespace    https://cl2.local/assetsnap
// @version      0.3.1
// @description  AssetSnap: capture webpage images with customizable trigger keys, high-resolution preference, optional format conversion, and editable timestamp naming.
// @author       CL
// @match        http://*/*
// @match        https://*/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @connect      *
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
 * AssetSnap_v0.3.1-CL
 * BASE VERSION: AssetSnap_v0.3.0-CL.user.js
 * RELEASE: 2026-09-15
 *
 * v0.3.1 scope:
 * - Shortcut capture now accepts a single letter/number OR Shift, Alt/Option, Control/Ctrl or Meta/Command.
 * - Modifier-only shortcuts remain usable while a normal webpage input/textarea/contenteditable has focus.
 * - Letter/number shortcuts still respect input protection, so typing in ChatGPT/search/editor fields is not intercepted.
 * - Shortcut labels adapt to macOS naming where useful (Option / Command) and stay compact in the capsule.
 * - Existing settings_v3/v2/v1 migrate in memory to settings_v4 without losing naming/output preferences.
 * - v0.3.0 editable filename-prefix behavior and all existing image acquisition/conversion/download behavior are retained.
 *
 * Explicitly not added in this slice:
 * - Full filename templates or custom separators.
 * - Custom timestamp/date formats.
 * - Site-specific adapters.
 * - Special handling for animated GIF / animated WebP.
 * - Custom operating-system absolute save paths.
 */

(function () {
    'use strict';

    var CONFIG = {
        PRODUCT_ID: 'AssetSnap',
        VERSION: '0.3.1',
        OWNER: 'CL',
        SETTINGS_KEY: 'settings_v4',
        LEGACY_SETTINGS_KEYS: ['settings_v3', 'settings_v2', 'settings_v1'],
        DEFAULTS: {
            shortcutKey: 'd',
            quality: 'high',
            outputFormat: 'original',
            conflictAction: 'uniquify',
            namingPrefix: 'AssetSnap',
            successFeedback: true,
            inputProtection: true,
            floatingY: 0.5
        },
        MIME_EXT: {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
            'image/svg+xml': 'svg',
            'image/avif': 'avif',
            'image/bmp': 'bmp',
            'image/x-icon': 'ico',
            'image/vnd.microsoft.icon': 'ico',
            'image/tiff': 'tif'
        },
        IMAGE_EXT_RE: /\.(jpe?g|png|webp|gif|svg|avif|bmp|ico|tiff?)(?:$|[?#])/i,
        STATUS_MS: 1050,
        TOAST_MS: 2200,
        RESULT_MS: 3600,
        XHR_TIMEOUT: 45000,
        HOVER_PROBE_TIMEOUT: 5000,
        JPEG_QUALITY: 0.92,
        FLOAT_MARGIN: 18,
        CAPSULE_HEIGHT: 38,
        CAPSULE_WIDTH: 154,
        NAMING_PREFIX_MAX_BYTES: 180
    };

    var RELEASE_IDENTITY = CONFIG.PRODUCT_ID + '_v' + CONFIG.VERSION + '-' + CONFIG.OWNER;
    var settings = loadSettings();
    var state = {
        continuous: false,
        shortcutHeld: false,
        captureShortcut: false,
        downloadCount: 0,
        pointerX: -1,
        pointerY: -1,
        hoverCandidate: null,
        hoverProbeSerial: 0,
        probeCache: {},
        statusTimer: null,
        toastTimer: null,
        resultTimer: null,
        resultObjectUrl: null,
        namingSecond: '',
        namingIndex: -1,
        namingEditing: false,
        drag: null
    };

    var ui = createUI();
    applyFloatingPosition();
    registerMenuCommands();
    renderSettings();
    renderMode();

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('blur', function () {
        state.shortcutHeld = false;
        hideTarget();
        renderMode();
    });
    window.addEventListener('scroll', function () {
        if (isArmed() && state.pointerX >= 0) {
            updateTargetAtPoint(state.pointerX, state.pointerY);
        }
    }, true);
    window.addEventListener('resize', function () {
        applyFloatingPosition();
        positionPanel();
        if (isArmed() && state.pointerX >= 0) {
            updateTargetAtPoint(state.pointerX, state.pointerY);
        }
    });

    function loadSettings() {
        var saved = null;
        var i;
        try {
            saved = GM_getValue(CONFIG.SETTINGS_KEY, null);
            if (!saved) {
                for (i = 0; i < CONFIG.LEGACY_SETTINGS_KEYS.length; i++) {
                    saved = GM_getValue(CONFIG.LEGACY_SETTINGS_KEYS[i], null);
                    if (saved) { break; }
                }
            }
        } catch (e) {
            saved = null;
        }
        if (!saved || typeof saved !== 'object') {
            saved = {};
        }
        var merged = copyObject(CONFIG.DEFAULTS);
        var key;
        for (key in saved) {
            if (Object.prototype.hasOwnProperty.call(saved, key)) {
                merged[key] = saved[key];
            }
        }
        merged.shortcutKey = normalizeShortcutKey(merged.shortcutKey) || CONFIG.DEFAULTS.shortcutKey;
        if (merged.quality !== 'high' && merged.quality !== 'current') {
            merged.quality = CONFIG.DEFAULTS.quality;
        }
        if (merged.outputFormat !== 'original' && merged.outputFormat !== 'jpg' && merged.outputFormat !== 'png') {
            merged.outputFormat = CONFIG.DEFAULTS.outputFormat;
        }
        if (merged.conflictAction !== 'uniquify' && merged.conflictAction !== 'prompt') {
            merged.conflictAction = CONFIG.DEFAULTS.conflictAction;
        }
        merged.namingPrefix = String(merged.namingPrefix == null ? CONFIG.DEFAULTS.namingPrefix : merged.namingPrefix);
        if (namingPrefixError(merged.namingPrefix)) {
            merged.namingPrefix = CONFIG.DEFAULTS.namingPrefix;
        }
        merged.successFeedback = merged.successFeedback !== false;
        merged.inputProtection = merged.inputProtection !== false;
        merged.floatingY = Number(merged.floatingY);
        if (!isFinite(merged.floatingY) || merged.floatingY < 0.08 || merged.floatingY > 0.92) {
            merged.floatingY = CONFIG.DEFAULTS.floatingY;
        }
        return merged;
    }

    function saveSettings() {
        try {
            GM_setValue(CONFIG.SETTINGS_KEY, copyObject(settings));
        } catch (e) {
            showToast('设置保存失败：' + shortError(e), 'error', true);
        }
    }

    function resetSettings() {
        settings = copyObject(CONFIG.DEFAULTS);
        state.shortcutHeld = false;
        state.captureShortcut = false;
        state.namingEditing = false;
        saveSettings();
        applyFloatingPosition();
        renderSettings();
        renderMode();
        showToast('已恢复默认设置', 'info', true);
    }

    function copyObject(value) {
        var out = {};
        var key;
        for (key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                out[key] = value[key];
            }
        }
        return out;
    }

    function createUI() {
        var host = document.createElement('div');
        host.id = 'assetsnap-host-' + Math.random().toString(36).slice(2);
        host.setAttribute('data-assetsnap', RELEASE_IDENTITY);
        document.documentElement.appendChild(host);
        var shadow = host.attachShadow({ mode: 'open' });

        var style = document.createElement('style');
        style.textContent = [
            ':host{all:initial;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif;color:#1d1d1f}',
            '*{box-sizing:border-box}',
            'button,select,input{font:inherit}',
            '.floating{position:fixed;right:18px;top:50%;z-index:2147483645;user-select:none}',
            '.capsule{width:154px;height:38px;border:1px solid rgba(0,0,0,.08);border-radius:14px;background:rgba(255,255,255,.92);backdrop-filter:saturate(180%) blur(18px);box-shadow:0 7px 24px rgba(0,0,0,.14);display:flex;align-items:center;overflow:hidden;transition:box-shadow .16s ease,transform .16s ease}',
            '.capsule:hover{box-shadow:0 10px 30px rgba(0,0,0,.18)}',
            '.modeArea{height:100%;flex:1;border:0;background:transparent;display:flex;align-items:center;gap:8px;padding:0 10px;cursor:grab;color:#1d1d1f;min-width:0;touch-action:none}',
            '.modeArea.dragging{cursor:grabbing}',
            '.track{width:30px;height:18px;border-radius:999px;background:#d2d2d7;position:relative;flex:0 0 auto;transition:.16s ease}',
            '.track:after{content:"";position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:2px;left:2px;box-shadow:0 1px 4px rgba(0,0,0,.28);transition:.16s ease}',
            '.capsule.active .track{background:#34c759}.capsule.active .track:after{left:14px}',
            '.modeText{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.iconBtn{width:36px;height:28px;margin-right:4px;border:0;border-left:1px solid rgba(0,0,0,.06);background:transparent;color:#3a3a3c;border-radius:9px;cursor:pointer;font-size:18px;line-height:1;display:grid;place-items:center;transition:.14s ease}',
            '.iconBtn:hover{background:rgba(0,0,0,.055)}',
            '.panel{position:fixed;right:182px;width:322px;max-height:min(560px,calc(100vh - 24px));overflow:auto;background:rgba(250,250,252,.96);backdrop-filter:saturate(180%) blur(24px);border:1px solid rgba(0,0,0,.085);border-radius:18px;box-shadow:0 18px 55px rgba(0,0,0,.18);z-index:2147483644;opacity:0;pointer-events:none;transform:translateX(10px) scale(.985);transform-origin:right center;transition:.15s ease}',
            '.panel.open{opacity:1;pointer-events:auto;transform:none}',
            '.head{display:flex;align-items:center;justify-content:space-between;padding:14px 14px 11px;border-bottom:1px solid rgba(0,0,0,.07)}',
            '.title{font-weight:700;font-size:15px;letter-spacing:-.01em}.ver{font-size:11px;color:#86868b;margin-top:2px}',
            '.close{width:26px;height:26px;border:0;border-radius:50%;background:#e9e9ed;color:#6e6e73;cursor:pointer;font-size:15px;line-height:1;padding:0}',
            '.group{padding:7px 9px}.group+.group{border-top:1px solid rgba(0,0,0,.06)}',
            '.row{min-height:42px;border-radius:11px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 7px}',
            '.row:hover{background:rgba(0,0,0,.026)}',
            '.rowText{min-width:0}.rowTitle{font-size:13px;font-weight:590;white-space:nowrap}.rowSub{font-size:10.5px;color:#86868b;margin-top:2px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}',
            '.control{border:0;background:#ededf1;border-radius:9px;padding:7px 26px 7px 9px;color:#1d1d1f;font-size:12px;max-width:138px;outline:none}',
            '.key{min-width:54px;border:0;border-radius:9px;background:#ededf1;color:#1d1d1f;padding:7px 10px;cursor:pointer;font-weight:650;font-size:12px}',
            '.key.capturing{box-shadow:0 0 0 2px #0a84ff inset;color:#0a84ff;background:#eaf4ff}',
            '.switch{width:38px;height:22px;background:#d2d2d7;border:0;border-radius:999px;position:relative;cursor:pointer;padding:0;flex:0 0 auto;transition:.16s ease}',
            '.switch:after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:#fff;top:2px;left:2px;box-shadow:0 1px 4px rgba(0,0,0,.22);transition:.16s ease}.switch.on{background:#34c759}.switch.on:after{left:18px}',
            '.segments{display:flex;background:#ededf1;border-radius:9px;padding:2px;gap:2px;flex:0 0 auto}',
            '.seg{border:0;background:transparent;border-radius:7px;padding:5px 7px;color:#6e6e73;font-size:11px;cursor:pointer;white-space:nowrap}',
            '.seg.on{background:#fff;color:#1d1d1f;box-shadow:0 1px 4px rgba(0,0,0,.12);font-weight:650}',
            '.info{width:22px;height:22px;border:0;border-radius:50%;background:#ededf1;color:#6e6e73;cursor:help;font-size:12px;display:grid;place-items:center}',
            '.fixedValue{font-size:11px;color:#6e6e73;max-width:150px;text-align:right;line-height:1.25}',
            '.namingEditor{width:154px;flex:0 0 auto;display:grid;grid-template-columns:minmax(0,1fr) 27px;gap:5px;align-items:center}',
            '.namingCurrent{font-size:11px;color:#6e6e73;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;min-width:0}',
            '.namingInput{display:none;width:100%;min-width:0;border:0;background:#ededf1;border-radius:9px;padding:7px 8px;color:#1d1d1f;font-size:11.5px;outline:none;box-shadow:0 0 0 0 rgba(10,132,255,0);transition:.14s ease}',
            '.namingInput:focus{box-shadow:0 0 0 2px rgba(10,132,255,.34)}',
            '.namingEditor.invalid .namingInput{box-shadow:0 0 0 2px rgba(255,69,58,.38)}',
            '.namingAction{width:27px;height:27px;border:0;border-radius:8px;background:#ededf1;color:#3a3a3c;cursor:pointer;padding:0;display:grid;place-items:center;font-size:13px;font-weight:700;line-height:1}',
            '.namingAction:hover{background:#e3e3e8}',
            '.namingExample{display:none;grid-column:1 / -1;font-size:9.5px;color:#86868b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;padding-top:1px}',
            '.namingEditor.editing .namingCurrent{display:none}.namingEditor.editing .namingInput{display:block}.namingEditor.editing .namingExample{display:block}',
            '.conversionHint{display:none;margin:2px 7px 7px;padding:7px 9px;border-radius:9px;background:#fff8e8;color:#8a5a00;font-size:10.5px;line-height:1.35}',
            '.conversionHint.show{display:block}',
            '.reset{width:100%;border:0;border-radius:10px;background:#ededf1;color:#3a3a3c;padding:8px 10px;cursor:pointer;font-size:12px;font-weight:590}',
            '.target{position:fixed;display:none;border:1.5px solid rgba(10,132,255,.95);border-radius:7px;box-shadow:0 0 0 3px rgba(10,132,255,.12);pointer-events:none;z-index:2147483642}',
            '.target.saving{border-color:#ff9f0a;box-shadow:0 0 0 3px rgba(255,159,10,.14)}.target.ok{border-color:#30d158;box-shadow:0 0 0 3px rgba(48,209,88,.14)}.target.error{border-color:#ff453a;box-shadow:0 0 0 3px rgba(255,69,58,.14)}',
            '.hoverMeta{position:fixed;display:none;pointer-events:none;z-index:2147483646;background:rgba(20,20,22,.84);backdrop-filter:blur(12px);color:#fff;border-radius:9px;padding:6px 8px;box-shadow:0 6px 18px rgba(0,0,0,.16);font-size:10.5px;line-height:1.25;max-width:180px}',
            '.hoverLine{display:flex;align-items:center;gap:6px;white-space:nowrap}.hoverBadge{font-weight:700}.hoverDim{color:#e5e5ea}.hoverConvert{margin-top:3px;color:#ffd60a;font-weight:650}',
            '.mini{position:fixed;display:none;padding:6px 8px;border-radius:8px;background:#30a14e;color:#fff;font-size:11px;font-weight:700;z-index:2147483646;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.16)}',
            '.mini.saving{background:#b56a00}.mini.error{background:#c9342c}',
            '.result{position:fixed;right:18px;bottom:18px;width:286px;min-height:68px;background:rgba(250,250,252,.96);backdrop-filter:saturate(180%) blur(22px);border:1px solid rgba(0,0,0,.08);border-radius:15px;box-shadow:0 14px 42px rgba(0,0,0,.18);z-index:2147483647;display:flex;gap:10px;align-items:center;padding:10px;opacity:0;pointer-events:none;transform:translateY(10px) scale(.985);transition:.16s ease}',
            '.result.show{opacity:1;transform:none}.thumb{width:48px;height:48px;border-radius:10px;object-fit:cover;background:#ececf0;flex:0 0 auto}.resultBody{min-width:0;flex:1}.resultTop{display:flex;align-items:center;justify-content:space-between;gap:8px}.resultTitle{font-size:12.5px;font-weight:700;color:#1d1d1f}.badge{font-size:9.5px;font-weight:700;border-radius:999px;padding:3px 6px;background:#e9f7ed;color:#1e7c38;white-space:nowrap}.resultMeta{font-size:10.5px;color:#6e6e73;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.resultConvert{font-size:10px;color:#b06b00;margin-top:3px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(12px);background:rgba(32,32,34,.92);backdrop-filter:blur(14px);color:#fff;padding:9px 12px;border-radius:10px;box-shadow:0 8px 26px rgba(0,0,0,.16);z-index:2147483647;opacity:0;pointer-events:none;transition:.16s ease;font-size:11.5px;max-width:min(520px,calc(100vw - 36px));line-height:1.35;text-align:center}',
            '.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}.toast.error{background:rgba(176,40,36,.94)}.toast.info{background:rgba(58,58,60,.94)}',
            '@media(max-width:720px){.floating{right:12px}.panel{right:12px;width:min(322px,calc(100vw - 24px))}.result{right:12px;bottom:12px;width:min(286px,calc(100vw - 24px))}}'
        ].join('');
        shadow.appendChild(style);

        var wrap = document.createElement('div');
        wrap.innerHTML = '' +
            '<div class="floating" id="floating">' +
                '<div class="capsule" id="capsule">' +
                    '<button class="modeArea" id="modeArea" type="button" aria-label="切换连续下载模式"><span class="track"></span><span class="modeText" id="modeText">D + 点击</span></button>' +
                    '<button class="iconBtn" id="settingsBtn" type="button" aria-label="AssetSnap 设置" title="AssetSnap 设置">↓</button>' +
                '</div>' +
            '</div>' +
            '<div class="panel" id="panel">' +
                '<div class="head"><div><div class="title">AssetSnap</div><div class="ver">' + escapeHtml(RELEASE_IDENTITY) + '</div></div><button class="close" id="close" type="button">×</button></div>' +
                '<div class="group">' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">快捷键</div><div class="rowSub">字母 / 数字 / Shift / Option / Ctrl / Command</div></div><button class="key" id="keyBtn" type="button">D + Click</button></div>' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">图片来源</div><div class="rowSub">优先寻找 srcset / 原图地址</div></div><select class="control" id="quality"><option value="high">优先高清 / 原图</option><option value="current">当前显示图</option></select></div>' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">输出格式</div><div class="rowSub">所有网站共用上次设置</div></div><div class="segments" id="formatSegments"><button class="seg" data-format="original" type="button">原格式</button><button class="seg" data-format="jpg" type="button">JPG</button><button class="seg" data-format="png" type="button">PNG</button></div></div>' +
                    '<div class="conversionHint" id="conversionHint">格式转换失败时自动保留原格式，优先保证图片能够下载。</div>' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">同名文件</div><div class="rowSub">时间同秒时 AssetSnap 自动加 _01 / _02</div></div><select class="control" id="conflict"><option value="uniquify">自动加序号</option><option value="prompt">冲突时询问</option></select></div>' +
                '</div>' +
                '<div class="group">' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">文件命名</div><div class="rowSub">修改 # 前的名称，日期自动添加</div></div><div class="namingEditor" id="namingEditor"><span class="namingCurrent" id="namingCurrent"></span><input class="namingInput" id="namingInput" type="text" maxlength="80" autocomplete="off" spellcheck="false" aria-label="命名前缀"><button class="namingAction" id="namingAction" type="button" aria-label="修改命名前缀" title="修改命名前缀">✎</button><div class="namingExample" id="namingExample"></div></div></div>' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">保存位置</div><div class="rowSub">浏览器默认下载目录</div></div><button class="info" type="button" title="AssetSnap 不管理系统绝对路径。若浏览器开启了“每次下载前询问保存位置”，浏览器仍可能弹出保存窗口。">i</button></div>' +
                '</div>' +
                '<div class="group">' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">下载完成提示</div><div class="rowSub">缩略图 / 分辨率 / 大小 / 格式</div></div><button class="switch" id="feedbackSwitch" type="button"></button></div>' +
                    '<div class="row"><div class="rowText"><div class="rowTitle">输入框保护</div><div class="rowSub">文字键输入时保护；修饰键仍可抓图</div></div><button class="switch" id="inputSwitch" type="button"></button></div>' +
                '</div>' +
                '<div class="group"><button class="reset" id="reset" type="button">恢复默认设置</button></div>' +
            '</div>' +
            '<div class="target" id="target"></div>' +
            '<div class="hoverMeta" id="hoverMeta"><div class="hoverLine"><span class="hoverBadge" id="hoverBadge"></span><span class="hoverDim" id="hoverDim"></span></div><div class="hoverConvert" id="hoverConvert"></div></div>' +
            '<div class="mini" id="mini"></div>' +
            '<div class="result" id="result"><img class="thumb" id="resultThumb" alt=""><div class="resultBody"><div class="resultTop"><span class="resultTitle">✓ 已保存</span><span class="badge" id="resultBadge"></span></div><div class="resultMeta" id="resultMeta"></div><div class="resultConvert" id="resultConvert"></div></div></div>' +
            '<div class="toast" id="toast"></div>';
        shadow.appendChild(wrap);

        var refs = {
            host: host,
            shadow: shadow,
            floating: shadow.getElementById('floating'),
            capsule: shadow.getElementById('capsule'),
            modeArea: shadow.getElementById('modeArea'),
            modeText: shadow.getElementById('modeText'),
            settingsBtn: shadow.getElementById('settingsBtn'),
            panel: shadow.getElementById('panel'),
            close: shadow.getElementById('close'),
            keyBtn: shadow.getElementById('keyBtn'),
            quality: shadow.getElementById('quality'),
            formatSegments: shadow.getElementById('formatSegments'),
            conversionHint: shadow.getElementById('conversionHint'),
            conflict: shadow.getElementById('conflict'),
            namingEditor: shadow.getElementById('namingEditor'),
            namingCurrent: shadow.getElementById('namingCurrent'),
            namingInput: shadow.getElementById('namingInput'),
            namingAction: shadow.getElementById('namingAction'),
            namingExample: shadow.getElementById('namingExample'),
            feedbackSwitch: shadow.getElementById('feedbackSwitch'),
            inputSwitch: shadow.getElementById('inputSwitch'),
            reset: shadow.getElementById('reset'),
            target: shadow.getElementById('target'),
            hoverMeta: shadow.getElementById('hoverMeta'),
            hoverBadge: shadow.getElementById('hoverBadge'),
            hoverDim: shadow.getElementById('hoverDim'),
            hoverConvert: shadow.getElementById('hoverConvert'),
            mini: shadow.getElementById('mini'),
            result: shadow.getElementById('result'),
            resultThumb: shadow.getElementById('resultThumb'),
            resultBadge: shadow.getElementById('resultBadge'),
            resultMeta: shadow.getElementById('resultMeta'),
            resultConvert: shadow.getElementById('resultConvert'),
            toast: shadow.getElementById('toast')
        };

        refs.modeArea.addEventListener('pointerdown', beginCapsulePointer);
        refs.settingsBtn.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            togglePanel();
        });
        refs.close.addEventListener('click', function () { setPanel(false); });
        refs.keyBtn.addEventListener('click', function () {
            state.captureShortcut = true;
            refs.keyBtn.textContent = '按键…';
            refs.keyBtn.classList.add('capturing');
            showToast('按一个字母、数字或修饰键；Esc 取消', 'info', true);
        });
        refs.quality.addEventListener('change', function () {
            settings.quality = refs.quality.value;
            saveSettings();
            if (isArmed() && state.pointerX >= 0) { updateTargetAtPoint(state.pointerX, state.pointerY); }
        });
        refs.formatSegments.addEventListener('click', function (event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-format]') : null;
            if (!button) { return; }
            var value = button.getAttribute('data-format');
            if (value !== 'original' && value !== 'jpg' && value !== 'png') { return; }
            settings.outputFormat = value;
            saveSettings();
            renderSettings();
            if (isArmed() && state.pointerX >= 0) { updateTargetAtPoint(state.pointerX, state.pointerY); }
        });
        refs.conflict.addEventListener('change', function () {
            settings.conflictAction = refs.conflict.value;
            saveSettings();
        });
        refs.namingAction.addEventListener('click', function () {
            if (state.namingEditing) { commitNamingEdit(); }
            else { beginNamingEdit(); }
        });
        refs.namingInput.addEventListener('input', function () {
            refs.namingEditor.classList.remove('invalid');
            updateNamingExample();
        });
        refs.namingInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                commitNamingEdit();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                cancelNamingEdit();
            }
        });
        refs.feedbackSwitch.addEventListener('click', function () {
            settings.successFeedback = !settings.successFeedback;
            saveSettings();
            renderSettings();
        });
        refs.inputSwitch.addEventListener('click', function () {
            settings.inputProtection = !settings.inputProtection;
            saveSettings();
            renderSettings();
        });
        refs.reset.addEventListener('click', resetSettings);

        return refs;
    }

    function beginCapsulePointer(event) {
        if (event.button !== undefined && event.button !== 0) { return; }
        state.drag = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startTop: currentFloatingTop(),
            moved: false
        };
        ui.modeArea.setPointerCapture(event.pointerId);
        ui.modeArea.addEventListener('pointermove', moveCapsulePointer);
        ui.modeArea.addEventListener('pointerup', endCapsulePointer);
        ui.modeArea.addEventListener('pointercancel', endCapsulePointer);
    }

    function moveCapsulePointer(event) {
        if (!state.drag || event.pointerId !== state.drag.pointerId) { return; }
        var dy = event.clientY - state.drag.startY;
        if (Math.abs(dy) > 4) {
            state.drag.moved = true;
            ui.modeArea.classList.add('dragging');
        }
        if (!state.drag.moved) { return; }
        event.preventDefault();
        var top = clampFloatingTop(state.drag.startTop + dy);
        ui.floating.style.top = top + 'px';
        ui.floating.style.transform = 'translateY(-50%)';
        positionPanel();
    }

    function endCapsulePointer(event) {
        if (!state.drag || event.pointerId !== state.drag.pointerId) { return; }
        var moved = state.drag.moved;
        try { ui.modeArea.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
        ui.modeArea.removeEventListener('pointermove', moveCapsulePointer);
        ui.modeArea.removeEventListener('pointerup', endCapsulePointer);
        ui.modeArea.removeEventListener('pointercancel', endCapsulePointer);
        ui.modeArea.classList.remove('dragging');
        state.drag = null;
        if (moved) {
            settings.floatingY = currentFloatingTop() / Math.max(1, window.innerHeight);
            settings.floatingY = Math.max(0.08, Math.min(0.92, settings.floatingY));
            saveSettings();
        } else {
            setContinuous(!state.continuous);
        }
    }

    function clampFloatingTop(top) {
        var half = CONFIG.CAPSULE_HEIGHT / 2;
        return Math.max(CONFIG.FLOAT_MARGIN + half, Math.min(window.innerHeight - CONFIG.FLOAT_MARGIN - half, top));
    }

    function currentFloatingTop() {
        var rect = ui.floating.getBoundingClientRect();
        if (rect && isFinite(rect.top) && rect.height) { return rect.top + rect.height / 2; }
        return settings.floatingY * window.innerHeight;
    }

    function applyFloatingPosition() {
        if (!ui || !ui.floating) { return; }
        var top = clampFloatingTop(settings.floatingY * Math.max(1, window.innerHeight));
        ui.floating.style.top = top + 'px';
        ui.floating.style.transform = 'translateY(-50%)';
    }

    function positionPanel() {
        if (!ui || !ui.panel || !ui.panel.classList.contains('open')) { return; }
        window.requestAnimationFrame(function () {
            var capsule = ui.floating.getBoundingClientRect();
            var panelHeight = ui.panel.offsetHeight || 420;
            var top = capsule.top + capsule.height / 2 - panelHeight / 2;
            top = Math.max(12, Math.min(window.innerHeight - panelHeight - 12, top));
            ui.panel.style.top = top + 'px';
            if (window.innerWidth < 720) {
                ui.panel.style.right = '12px';
            } else {
                ui.panel.style.right = (CONFIG.FLOAT_MARGIN + CONFIG.CAPSULE_WIDTH + 10) + 'px';
            }
        });
    }

    function registerMenuCommands() {
        try {
            GM_registerMenuCommand(RELEASE_IDENTITY + ' · 打开 / 关闭设置', function () { togglePanel(); });
            GM_registerMenuCommand(RELEASE_IDENTITY + ' · 切换连续下载模式', function () { setContinuous(!state.continuous); });
            GM_registerMenuCommand(RELEASE_IDENTITY + ' · 恢复默认设置', function () { resetSettings(); });
        } catch (e) {
            // Menu support is non-critical.
        }
    }

    function renderSettings() {
        ui.keyBtn.textContent = state.captureShortcut ? '按键…' : shortcutLabel(settings.shortcutKey, false) + ' + Click';
        ui.keyBtn.classList.toggle('capturing', state.captureShortcut);
        ui.quality.value = settings.quality;
        ui.conflict.value = settings.conflictAction;
        ui.feedbackSwitch.classList.toggle('on', settings.successFeedback);
        ui.inputSwitch.classList.toggle('on', settings.inputProtection);
        var buttons = ui.formatSegments.querySelectorAll('[data-format]');
        var i;
        for (i = 0; i < buttons.length; i++) {
            buttons[i].classList.toggle('on', buttons[i].getAttribute('data-format') === settings.outputFormat);
        }
        ui.conversionHint.classList.toggle('show', settings.outputFormat !== 'original');
        renderNamingControl();
    }

    function renderNamingControl() {
        if (!ui.namingEditor) { return; }
        ui.namingEditor.classList.toggle('editing', state.namingEditing);
        ui.namingEditor.classList.remove('invalid');
        if (state.namingEditing) {
            ui.namingAction.textContent = '✓';
            ui.namingAction.setAttribute('aria-label', '保存命名前缀');
            ui.namingAction.title = '保存命名前缀';
            updateNamingExample();
        } else {
            ui.namingCurrent.textContent = '当前命名：' + settings.namingPrefix;
            ui.namingCurrent.title = settings.namingPrefix;
            ui.namingInput.value = settings.namingPrefix;
            ui.namingAction.textContent = '✎';
            ui.namingAction.setAttribute('aria-label', '修改命名前缀');
            ui.namingAction.title = '修改命名前缀';
            ui.namingExample.textContent = '';
        }
    }

    function beginNamingEdit() {
        state.namingEditing = true;
        ui.namingInput.value = settings.namingPrefix;
        renderNamingControl();
        window.setTimeout(function () {
            try { ui.namingInput.focus(); ui.namingInput.select(); } catch (e) { /* ignore */ }
        }, 0);
    }

    function cancelNamingEdit() {
        state.namingEditing = false;
        ui.namingInput.value = settings.namingPrefix;
        renderNamingControl();
    }

    function commitNamingEdit() {
        var value = String(ui.namingInput.value || '');
        var error = namingPrefixError(value);
        if (error) {
            ui.namingEditor.classList.add('invalid');
            showToast(error, 'error', true);
            try { ui.namingInput.focus(); } catch (e) { /* ignore */ }
            return false;
        }
        settings.namingPrefix = value;
        state.namingEditing = false;
        saveSettings();
        renderNamingControl();
        return true;
    }

    function updateNamingExample() {
        if (!state.namingEditing) { return; }
        var draft = String(ui.namingInput.value || '');
        var sample = draft || CONFIG.DEFAULTS.namingPrefix;
        ui.namingExample.textContent = '示例：' + sample + '#' + timestampForName(new Date());
        ui.namingExample.title = ui.namingExample.textContent;
    }

    function utf8ByteLength(text) {
        try {
            return encodeURIComponent(String(text)).replace(/%[0-9A-F]{2}|./g, 'x').length;
        } catch (e) {
            return Infinity;
        }
    }

    function namingPrefixError(value) {
        value = String(value == null ? '' : value);
        if (!value || !value.replace(/\s/g, '')) { return '命名前缀不能为空'; }
        if (value !== value.replace(/^\s+|\s+$/g, '')) { return '命名前缀前后不能有空格'; }
        if (/^\./.test(value)) { return '命名前缀不能以点开头'; }
        if (/[#\\\/:*?"<>|\x00-\x1f\x7f]/.test(value)) { return '命名前缀不能包含 # / \\ : * ? " < > | 或控制字符'; }
        if (/[. ]$/.test(value)) { return '命名前缀不能以点或空格结尾'; }
        if (utf8ByteLength(value) > CONFIG.NAMING_PREFIX_MAX_BYTES) { return '命名前缀过长，请缩短后再保存'; }
        return '';
    }

    function normalizeShortcutKey(value) {
        var text = String(value == null ? '' : value);
        if (/^[a-z0-9]$/i.test(text)) { return text.toLowerCase(); }
        text = text.toLowerCase();
        if (text === 'shift') { return 'shift'; }
        if (text === 'alt' || text === 'option') { return 'alt'; }
        if (text === 'control' || text === 'ctrl') { return 'control'; }
        if (text === 'meta' || text === 'command' || text === 'cmd') { return 'meta'; }
        return '';
    }

    function isModifierShortcut(value) {
        value = normalizeShortcutKey(value);
        return value === 'shift' || value === 'alt' || value === 'control' || value === 'meta';
    }

    function isMacPlatform() {
        var platform = '';
        try {
            platform = String((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '');
        } catch (e) {
            platform = '';
        }
        return /mac|iphone|ipad|ipod/i.test(platform);
    }

    function shortcutLabel(value, compact) {
        value = normalizeShortcutKey(value) || CONFIG.DEFAULTS.shortcutKey;
        if (!isModifierShortcut(value)) { return value.toUpperCase(); }
        var mac = isMacPlatform();
        if (value === 'shift') { return compact && mac ? '⇧' : 'Shift'; }
        if (value === 'alt') { return mac ? (compact ? '⌥' : 'Option') : 'Alt'; }
        if (value === 'control') { return mac ? (compact ? '⌃' : 'Control') : 'Ctrl'; }
        if (value === 'meta') { return mac ? (compact ? '⌘' : 'Command') : 'Meta'; }
        return value;
    }

    function renderMode() {
        ui.capsule.classList.toggle('active', state.continuous);
        ui.modeText.textContent = state.continuous ? ('连续下载 · ' + state.downloadCount) : (shortcutLabel(settings.shortcutKey, true) + ' + 点击');
        if (!isArmed()) { hideTarget(); }
    }

    function setContinuous(value) {
        state.continuous = value === true;
        if (!state.continuous) { state.shortcutHeld = false; }
        renderMode();
        if (isArmed() && state.pointerX >= 0) { updateTargetAtPoint(state.pointerX, state.pointerY); }
    }

    function togglePanel() { setPanel(!ui.panel.classList.contains('open')); }

    function setPanel(open) {
        ui.panel.classList.toggle('open', !!open);
        if (!open && state.captureShortcut) { cancelShortcutCapture(); }
        if (!open && state.namingEditing) { cancelNamingEdit(); }
        if (open) { positionPanel(); }
    }

    function cancelShortcutCapture() {
        state.captureShortcut = false;
        renderSettings();
    }

    function isArmed() { return state.continuous || state.shortcutHeld; }

    function eventInsideUI(event) {
        var path = typeof event.composedPath === 'function' ? event.composedPath() : [];
        var i;
        for (i = 0; i < path.length; i++) {
            if (path[i] === ui.host) { return true; }
        }
        return event.target === ui.host;
    }

    function eventIsEditable(event) {
        if (!settings.inputProtection) { return false; }
        var path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
        var i, el, tag;
        for (i = 0; i < path.length; i++) {
            el = path[i];
            if (!el || el.nodeType !== 1) { continue; }
            tag = String(el.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) { return true; }
        }
        return false;
    }

    function onKeyDown(event) {
        if (state.namingEditing && event.key === 'Escape') {
            var namingPath = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
            var namingIndex;
            for (namingIndex = 0; namingIndex < namingPath.length; namingIndex++) {
                if (namingPath[namingIndex] === ui.namingInput) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    cancelNamingEdit();
                    return;
                }
            }
        }
        if (state.captureShortcut) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                cancelShortcutCapture();
                showToast('已取消快捷键修改', 'info', true);
                return;
            }
            var capturedShortcut = normalizeShortcutKey(event.key);
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!capturedShortcut) {
                showToast('仅支持字母、数字、Shift、Option/Alt、Control/Ctrl、Command/Meta', 'error', true);
                return;
            }
            settings.shortcutKey = capturedShortcut;
            state.shortcutHeld = false;
            state.captureShortcut = false;
            saveSettings();
            renderSettings();
            renderMode();
            showToast('快捷键已改为 ' + shortcutLabel(capturedShortcut, false) + ' + Click', 'info', true);
            return;
        }
        if (event.key === 'Escape') {
            if (state.continuous) { setContinuous(false); }
            if (ui.panel.classList.contains('open')) { setPanel(false); }
            return;
        }
        var pressedShortcut = normalizeShortcutKey(event.key);
        if (!pressedShortcut || pressedShortcut !== settings.shortcutKey) { return; }
        if (isModifierShortcut(settings.shortcutKey)) {
            // Modifier-only shortcuts are intentionally usable even when a normal
            // webpage text field has focus. This avoids D/letter input conflicts
            // on ChatGPT, editors and search boxes. AssetSnap's own UI stays protected.
            if (eventInsideUI(event)) { return; }
        } else {
            // Letter/number shortcuts stay conservative: do not fire as part of
            // another key combination and do not intercept typing in editable fields.
            if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) { return; }
            if (eventIsEditable(event)) { return; }
        }
        state.shortcutHeld = true;
        renderMode();
        if (state.pointerX >= 0) { updateTargetAtPoint(state.pointerX, state.pointerY); }
    }

    function onKeyUp(event) {
        if (normalizeShortcutKey(event.key) === settings.shortcutKey) {
            state.shortcutHeld = false;
            renderMode();
        }
    }

    function onMouseMove(event) {
        if (eventInsideUI(event)) {
            hideTarget();
            return;
        }
        state.pointerX = event.clientX;
        state.pointerY = event.clientY;
        if (isArmed()) { updateTargetAtPoint(event.clientX, event.clientY); }
    }

    function onDocumentClick(event) {
        if (event.button !== 0 || eventInsideUI(event) || !isArmed()) { return; }
        var candidate = findCandidateAtPoint(event.clientX, event.clientY);
        if (!candidate) { return; }
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') { event.stopImmediatePropagation(); }
        candidate.downloadBase = allocateDownloadBase();
        candidate.requestedOutput = settings.outputFormat;
        candidate.qualityLabel = qualityLabel(candidate);
        showCandidateStatus(candidate, '正在读取…', 'saving');
        downloadCandidate(candidate);
    }

    function sameCandidate(a, b) {
        return !!a && !!b && a.kind === b.kind && a.element === b.element && String(a.url || '') === String(b.url || '');
    }

    function updateTargetAtPoint(x, y) {
        if (!isArmed() || x < 0 || y < 0) {
            hideTarget();
            return;
        }
        var candidate = findCandidateAtPoint(x, y);
        if (!candidate || !candidate.element) {
            hideTarget();
            return;
        }
        if (sameCandidate(state.hoverCandidate, candidate)) {
            candidate = state.hoverCandidate;
        } else {
            state.hoverCandidate = candidate;
        }
        showTarget(candidate.element, '');
        renderHoverMeta(candidate);
        probeCandidate(candidate);
    }

    function showTarget(element, tone) {
        var rect;
        try { rect = element.getBoundingClientRect(); } catch (e) { hideTarget(); return; }
        if (!rect || rect.width < 2 || rect.height < 2) { hideTarget(); return; }
        ui.target.style.display = 'block';
        ui.target.style.left = Math.max(0, rect.left) + 'px';
        ui.target.style.top = Math.max(0, rect.top) + 'px';
        ui.target.style.width = Math.max(0, Math.min(rect.width, window.innerWidth - Math.max(0, rect.left))) + 'px';
        ui.target.style.height = Math.max(0, Math.min(rect.height, window.innerHeight - Math.max(0, rect.top))) + 'px';
        ui.target.className = 'target' + (tone ? ' ' + tone : '');
    }

    function hideTarget() {
        state.hoverCandidate = null;
        state.hoverProbeSerial += 1;
        ui.target.style.display = 'none';
        ui.target.className = 'target';
        ui.hoverMeta.style.display = 'none';
    }

    function renderHoverMeta(candidate) {
        if (!candidate || !candidate.element || !isArmed()) {
            ui.hoverMeta.style.display = 'none';
            return;
        }
        var rect;
        try { rect = candidate.element.getBoundingClientRect(); } catch (e) { return; }
        var label = qualityLabel(candidate);
        var dims = candidate.probe && candidate.probe.width && candidate.probe.height ?
            (candidate.probe.width + ' × ' + candidate.probe.height) : dimensionsFromElement(candidate);
        ui.hoverBadge.textContent = label;
        ui.hoverDim.textContent = dims || '读取尺寸…';
        var sourceExt = candidate.probe && candidate.probe.ext ? candidate.probe.ext : inferOriginalExtension(candidate);
        var targetExt = settings.outputFormat === 'original' ? '' : settings.outputFormat;
        ui.hoverConvert.textContent = sourceExt && targetExt && normalizeExt(sourceExt) !== normalizeExt(targetExt) ?
            (displayExt(sourceExt) + ' → ' + displayExt(targetExt)) : '';
        ui.hoverConvert.style.display = ui.hoverConvert.textContent ? 'block' : 'none';
        ui.hoverMeta.style.display = 'block';
        var left = Math.max(8, Math.min(window.innerWidth - 188, rect.right - 176));
        var top = rect.bottom + 7;
        if (top + 48 > window.innerHeight) { top = Math.max(8, rect.top - 49); }
        ui.hoverMeta.style.left = left + 'px';
        ui.hoverMeta.style.top = top + 'px';
    }

    function probeCandidate(candidate) {
        if (!candidate || candidate.probing || candidate.probe) { return; }
        if (candidate.kind === 'canvas') {
            candidate.probe = { width: candidate.element.width || 0, height: candidate.element.height || 0, ext: 'png' };
            renderHoverMeta(candidate);
            return;
        }
        if (candidate.kind === 'svg') {
            var r = candidate.element.getBoundingClientRect();
            candidate.probe = { width: Math.round(r.width || 0), height: Math.round(r.height || 0), ext: 'svg' };
            renderHoverMeta(candidate);
            return;
        }
        if (!candidate.url) { return; }
        var key = candidate.url;
        if (state.probeCache[key]) {
            candidate.probe = copyObject(state.probeCache[key]);
            renderHoverMeta(candidate);
            return;
        }
        candidate.probing = true;
        var serial = ++state.hoverProbeSerial;
        var img = new Image();
        var timer = window.setTimeout(function () {
            candidate.probing = false;
            img.onload = img.onerror = null;
        }, CONFIG.HOVER_PROBE_TIMEOUT);
        img.onload = function () {
            clearTimeout(timer);
            candidate.probing = false;
            var info = {
                width: Number(img.naturalWidth || img.width || 0),
                height: Number(img.naturalHeight || img.height || 0),
                ext: inferOriginalExtension(candidate)
            };
            candidate.probe = info;
            state.probeCache[key] = copyObject(info);
            if (serial === state.hoverProbeSerial && sameCandidate(state.hoverCandidate, candidate)) { renderHoverMeta(candidate); }
        };
        img.onerror = function () {
            clearTimeout(timer);
            candidate.probing = false;
            var dims = dimensionsFromElement(candidate);
            if (dims) {
                var parts = dims.split('×');
                candidate.probe = {
                    width: Number(parts[0].replace(/\s/g, '')) || 0,
                    height: Number(parts[1].replace(/\s/g, '')) || 0,
                    ext: inferOriginalExtension(candidate)
                };
            }
            if (serial === state.hoverProbeSerial && sameCandidate(state.hoverCandidate, candidate)) { renderHoverMeta(candidate); }
        };
        try { img.src = candidate.url; } catch (e) { img.onerror(); }
    }

    function dimensionsFromElement(candidate) {
        if (!candidate || !candidate.element) { return ''; }
        var el = candidate.element;
        var w = Number(el.naturalWidth || el.width || 0);
        var h = Number(el.naturalHeight || el.height || 0);
        if (w > 0 && h > 0) { return Math.round(w) + ' × ' + Math.round(h); }
        return '';
    }

    function showCandidateStatus(candidate, text, tone) {
        ui.hoverMeta.style.display = 'none';
        if (!candidate || !candidate.element) {
            showToast(text, tone === 'error' ? 'error' : 'info', true);
            return;
        }
        showTarget(candidate.element, tone);
        var rect = candidate.element.getBoundingClientRect();
        ui.mini.textContent = text;
        ui.mini.className = 'mini' + (tone ? ' ' + tone : '');
        ui.mini.style.display = 'block';
        ui.mini.style.left = Math.max(8, Math.min(window.innerWidth - 120, rect.left + 8)) + 'px';
        ui.mini.style.top = Math.max(8, rect.top + 8) + 'px';
        clearTimeout(state.statusTimer);
        state.statusTimer = window.setTimeout(function () {
            ui.mini.style.display = 'none';
            if (!isArmed()) { hideTarget(); }
            else if (state.pointerX >= 0) { updateTargetAtPoint(state.pointerX, state.pointerY); }
        }, CONFIG.STATUS_MS);
    }

    function showToast(text, tone, force) {
        if (!force && !settings.successFeedback) { return; }
        clearTimeout(state.toastTimer);
        ui.toast.textContent = text;
        ui.toast.className = 'toast ' + (tone || 'info') + ' show';
        state.toastTimer = window.setTimeout(function () { ui.toast.classList.remove('show'); }, CONFIG.TOAST_MS);
    }

    function showResultCard(candidate, filename, info, blob) {
        if (!settings.successFeedback) { return; }
        clearTimeout(state.resultTimer);
        if (state.resultObjectUrl) {
            try { URL.revokeObjectURL(state.resultObjectUrl); } catch (e) { /* ignore */ }
            state.resultObjectUrl = null;
        }
        var thumb = '';
        if (blob) {
            try {
                state.resultObjectUrl = URL.createObjectURL(blob);
                thumb = state.resultObjectUrl;
            } catch (e2) { thumb = ''; }
        }
        if (!thumb && candidate && candidate.url) { thumb = candidate.url; }
        ui.resultThumb.style.display = thumb ? 'block' : 'none';
        if (thumb) { ui.resultThumb.src = thumb; }
        ui.resultBadge.textContent = (info && info.qualityLabel) || qualityLabel(candidate);
        var meta = [];
        if (info && info.width && info.height) { meta.push(info.width + ' × ' + info.height + ' px'); }
        if (info && typeof info.bytes === 'number' && info.bytes >= 0) { meta.push(formatBytes(info.bytes)); }
        if (info && info.format) { meta.push(displayExt(info.format)); }
        ui.resultMeta.textContent = meta.length ? meta.join(' · ') : filename;
        if (info && info.converted && info.sourceExt && info.finalExt) {
            ui.resultConvert.textContent = displayExt(info.sourceExt) + ' → ' + displayExt(info.finalExt);
        } else if (info && info.conversionFallback) {
            ui.resultConvert.textContent = '⚠ 转换不可用 · 已保留原格式';
        } else {
            ui.resultConvert.textContent = filename;
        }
        ui.result.classList.add('show');
        state.resultTimer = window.setTimeout(function () {
            ui.result.classList.remove('show');
            if (state.resultObjectUrl) {
                try { URL.revokeObjectURL(state.resultObjectUrl); } catch (e3) { /* ignore */ }
                state.resultObjectUrl = null;
            }
        }, CONFIG.RESULT_MS);
    }

    function downloadCandidate(candidate) {
        if (candidate.kind === 'canvas') {
            captureCanvas(candidate);
            return;
        }
        if (candidate.kind === 'svg') {
            captureSvg(candidate);
            return;
        }
        if (!candidate.url) {
            failDownload(candidate, '没有找到可下载的图片地址');
            return;
        }
        acquireBlob(candidate);
    }

    function acquireBlob(candidate) {
        if (/^https?:/i.test(candidate.url)) {
            try {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: candidate.url,
                    responseType: 'blob',
                    anonymous: false,
                    timeout: CONFIG.XHR_TIMEOUT,
                    onload: function (response) {
                        if (!response || response.status < 200 || response.status >= 400 || !response.response || !response.response.size) {
                            fallbackDirect(candidate, '无法读取图片数据');
                            return;
                        }
                        processBlob(candidate, response.response);
                    },
                    onerror: function () { fallbackDirect(candidate, '图片服务器拒绝跨域读取'); },
                    ontimeout: function () { fallbackDirect(candidate, '读取图片超时'); }
                });
            } catch (e) {
                fallbackDirect(candidate, shortError(e));
            }
            return;
        }
        try {
            fetch(candidate.url).then(function (response) {
                if (!response.ok && !/^data:|^blob:/i.test(candidate.url)) { throw new Error('HTTP ' + response.status); }
                return response.blob();
            }).then(function (blob) {
                if (!blob || !blob.size) { throw new Error('图片为空'); }
                processBlob(candidate, blob);
            }).catch(function (error) {
                fallbackDirect(candidate, shortError(error));
            });
        } catch (e2) {
            fallbackDirect(candidate, shortError(e2));
        }
    }

    function processBlob(candidate, blob) {
        var sourceExt = mimeExtension(blob.type) || inferOriginalExtension(candidate) || 'jpg';
        var requested = candidate.requestedOutput || 'original';
        if (requested === 'original' || normalizeExt(sourceExt) === normalizeExt(requested)) {
            getBlobDimensions(blob, function (dims) {
                saveBlob(candidate, blob, candidate.downloadBase + '.' + normalizeExt(sourceExt), {
                    width: dims.width,
                    height: dims.height,
                    bytes: blob.size,
                    format: normalizeExt(sourceExt),
                    sourceExt: normalizeExt(sourceExt),
                    finalExt: normalizeExt(sourceExt),
                    converted: false,
                    conversionFallback: false,
                    qualityLabel: candidate.qualityLabel || qualityLabel(candidate)
                });
            });
            return;
        }
        showCandidateStatus(candidate, '正在转换为 ' + displayExt(requested) + '…', 'saving');
        convertBlob(blob, requested, function (result, error) {
            if (result && result.blob && result.blob.size) {
                saveBlob(candidate, result.blob, candidate.downloadBase + '.' + requested, {
                    width: result.width,
                    height: result.height,
                    bytes: result.blob.size,
                    format: requested,
                    sourceExt: normalizeExt(sourceExt),
                    finalExt: requested,
                    converted: true,
                    conversionFallback: false,
                    qualityLabel: candidate.qualityLabel || qualityLabel(candidate)
                });
                return;
            }
            getBlobDimensions(blob, function (dims) {
                saveBlob(candidate, blob, candidate.downloadBase + '.' + normalizeExt(sourceExt), {
                    width: dims.width,
                    height: dims.height,
                    bytes: blob.size,
                    format: normalizeExt(sourceExt),
                    sourceExt: normalizeExt(sourceExt),
                    finalExt: normalizeExt(sourceExt),
                    converted: false,
                    conversionFallback: true,
                    conversionError: error || '转换失败',
                    qualityLabel: candidate.qualityLabel || qualityLabel(candidate)
                });
            });
        });
    }

    function convertBlob(blob, targetExt, callback) {
        var objectUrl = null;
        try {
            objectUrl = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
                var width = Number(img.naturalWidth || img.width || 0);
                var height = Number(img.naturalHeight || img.height || 0);
                if (!(width > 0 && height > 0)) {
                    cleanup();
                    callback(null, '无法读取图片尺寸');
                    return;
                }
                try {
                    var canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    var ctx = canvas.getContext('2d', { alpha: targetExt !== 'jpg' });
                    if (!ctx) { throw new Error('Canvas 不可用'); }
                    if (targetExt === 'jpg') {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    var mime = targetExt === 'jpg' ? 'image/jpeg' : 'image/png';
                    canvas.toBlob(function (out) {
                        cleanup();
                        if (!out || !out.size) {
                            callback(null, '浏览器无法编码目标格式');
                            return;
                        }
                        callback({ blob: out, width: width, height: height }, null);
                    }, mime, targetExt === 'jpg' ? CONFIG.JPEG_QUALITY : undefined);
                } catch (e) {
                    cleanup();
                    callback(null, shortError(e));
                }
            };
            img.onerror = function () {
                cleanup();
                callback(null, '浏览器无法解码图片');
            };
            img.src = objectUrl;
        } catch (e2) {
            cleanup();
            callback(null, shortError(e2));
        }
        function cleanup() {
            if (objectUrl) {
                try { URL.revokeObjectURL(objectUrl); } catch (e) { /* ignore */ }
                objectUrl = null;
            }
        }
    }

    function getBlobDimensions(blob, callback) {
        var objectUrl = null;
        try {
            objectUrl = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function () {
                var result = { width: Number(img.naturalWidth || img.width || 0), height: Number(img.naturalHeight || img.height || 0) };
                cleanup();
                callback(result);
            };
            img.onerror = function () {
                cleanup();
                callback({ width: 0, height: 0 });
            };
            img.src = objectUrl;
        } catch (e2) {
            cleanup();
            callback({ width: 0, height: 0 });
        }
        function cleanup() {
            if (objectUrl) {
                try { URL.revokeObjectURL(objectUrl); } catch (e) { /* ignore */ }
                objectUrl = null;
            }
        }
    }

    function fallbackDirect(candidate, reason) {
        var ext = inferOriginalExtension(candidate) || 'jpg';
        var conversionFallback = candidate.requestedOutput !== 'original' && normalizeExt(candidate.requestedOutput) !== normalizeExt(ext);
        showCandidateStatus(candidate, conversionFallback ? '转换不可用 · 保存原图…' : '直接保存…', 'saving');
        var filename = candidate.downloadBase + '.' + normalizeExt(ext);
        var dims = candidate.probe || dimensionsObjectFromElement(candidate);
        directDownload(candidate, filename, {
            width: dims.width || 0,
            height: dims.height || 0,
            bytes: null,
            format: normalizeExt(ext),
            sourceExt: normalizeExt(ext),
            finalExt: normalizeExt(ext),
            converted: false,
            conversionFallback: conversionFallback,
            conversionError: reason || '',
            qualityLabel: candidate.qualityLabel || qualityLabel(candidate)
        });
    }

    function directDownload(candidate, filename, info) {
        var details = {
            url: candidate.url,
            name: filename,
            saveAs: false,
            conflictAction: settings.conflictAction,
            anonymous: false,
            onload: function () { completeDownload(candidate, filename, info, null); },
            onerror: function (error) { failDownload(candidate, explainDownloadError(error)); },
            ontimeout: function () { failDownload(candidate, '下载超时'); }
        };
        try { GM_download(details); } catch (e) { failDownload(candidate, shortError(e)); }
    }

    function saveBlob(candidate, blob, filename, info) {
        if (!blob || !blob.size) {
            fallbackDirect(candidate, '读取到的图片为空');
            return;
        }
        var objectUrl = null;
        var done = false;
        function cleanup() {
            if (objectUrl) {
                try { URL.revokeObjectURL(objectUrl); } catch (e) { /* ignore */ }
                objectUrl = null;
            }
        }
        var details = {
            url: blob,
            name: filename,
            saveAs: false,
            conflictAction: settings.conflictAction,
            onload: function () {
                done = true;
                cleanup();
                completeDownload(candidate, filename, info, blob);
            },
            onerror: function (error) {
                if (!objectUrl) {
                    try {
                        objectUrl = URL.createObjectURL(blob);
                        GM_download({
                            url: objectUrl,
                            name: filename,
                            saveAs: false,
                            conflictAction: settings.conflictAction,
                            onload: function () {
                                done = true;
                                cleanup();
                                completeDownload(candidate, filename, info, blob);
                            },
                            onerror: function (secondError) {
                                cleanup();
                                blobSaveFailure(candidate, explainDownloadError(secondError || error));
                            },
                            ontimeout: function () {
                                cleanup();
                                blobSaveFailure(candidate, 'Blob 下载超时');
                            }
                        });
                        return;
                    } catch (e) {
                        cleanup();
                        blobSaveFailure(candidate, shortError(e));
                        return;
                    }
                }
                cleanup();
                blobSaveFailure(candidate, explainDownloadError(error));
            },
            ontimeout: function () {
                cleanup();
                blobSaveFailure(candidate, 'Blob 下载超时');
            }
        };
        try {
            GM_download(details);
        } catch (e) {
            if (!done) {
                try {
                    objectUrl = URL.createObjectURL(blob);
                    GM_download({
                        url: objectUrl,
                        name: filename,
                        saveAs: false,
                        conflictAction: settings.conflictAction,
                        onload: function () { cleanup(); completeDownload(candidate, filename, info, blob); },
                        onerror: function (error) { cleanup(); blobSaveFailure(candidate, explainDownloadError(error)); },
                        ontimeout: function () { cleanup(); blobSaveFailure(candidate, 'Blob 下载超时'); }
                    });
                } catch (second) {
                    cleanup();
                    blobSaveFailure(candidate, shortError(second));
                }
            }
        }
    }

    function blobSaveFailure(candidate, message) {
        if (candidate && candidate.url) {
            fallbackDirect(candidate, message || 'Blob 保存方式不可用');
        } else {
            failDownload(candidate, message || 'Blob 保存方式不可用');
        }
    }

    function captureCanvas(candidate) {
        try {
            var target = candidate.requestedOutput || 'original';
            var mime = target === 'jpg' ? 'image/jpeg' : 'image/png';
            var ext = target === 'jpg' ? 'jpg' : 'png';
            candidate.element.toBlob(function (blob) {
                if (!blob) {
                    failDownload(candidate, 'Canvas 无法导出，可能受到跨域保护');
                    return;
                }
                saveBlob(candidate, blob, candidate.downloadBase + '.' + ext, {
                    width: candidate.element.width || 0,
                    height: candidate.element.height || 0,
                    bytes: blob.size,
                    format: ext,
                    sourceExt: 'png',
                    finalExt: ext,
                    converted: target === 'jpg',
                    conversionFallback: false,
                    qualityLabel: candidate.qualityLabel || '当前显示图'
                });
            }, mime, ext === 'jpg' ? CONFIG.JPEG_QUALITY : undefined);
        } catch (e) {
            failDownload(candidate, 'Canvas 无法导出：' + shortError(e));
        }
    }

    function captureSvg(candidate) {
        try {
            var clone = candidate.element.cloneNode(true);
            if (!clone.getAttribute('xmlns')) { clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); }
            var text = new XMLSerializer().serializeToString(clone);
            var blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
            if (candidate.requestedOutput === 'original') {
                var rect = candidate.element.getBoundingClientRect();
                saveBlob(candidate, blob, candidate.downloadBase + '.svg', {
                    width: Math.round(rect.width || 0),
                    height: Math.round(rect.height || 0),
                    bytes: blob.size,
                    format: 'svg',
                    sourceExt: 'svg',
                    finalExt: 'svg',
                    converted: false,
                    conversionFallback: false,
                    qualityLabel: candidate.qualityLabel || '当前显示图'
                });
            } else {
                processBlob(candidate, blob);
            }
        } catch (e) {
            failDownload(candidate, 'SVG 无法导出：' + shortError(e));
        }
    }

    function completeDownload(candidate, filename, info, blob) {
        state.downloadCount += 1;
        renderMode();
        showCandidateStatus(candidate, '✓ 已保存', 'ok');
        showResultCard(candidate, filename, info || {}, blob);
    }

    function failDownload(candidate, message) {
        showCandidateStatus(candidate, '⚠ 保存失败', 'error');
        showToast('⚠ ' + message, 'error', true);
    }

    function explainDownloadError(error) {
        var code = error && error.error ? String(error.error) : '';
        var details = error && error.details ? String(error.details) : '';
        if (code === 'not_enabled') { return 'Tampermonkey 下载功能未启用，请在 Tampermonkey 设置中开启下载能力'; }
        if (code === 'not_whitelisted') { return '该文件扩展名未在 Tampermonkey 下载白名单中'; }
        if (code === 'not_permitted') { return 'Tampermonkey 没有浏览器下载权限'; }
        if (code === 'not_supported') { return '当前浏览器 / Tampermonkey 下载模式不支持此下载方式'; }
        if (code === 'timeout') { return '下载超时'; }
        if (code) { return '下载失败：' + code + (details ? ' · ' + details : ''); }
        return '下载失败' + (details ? '：' + details : '');
    }

    function findCandidateAtPoint(x, y) {
        var stack;
        try { stack = document.elementsFromPoint(x, y) || []; } catch (e) { stack = []; }
        var i, candidate, node, parent, depth;
        for (i = 0; i < stack.length; i++) {
            node = stack[i];
            if (!node || node === ui.host || (ui.host.contains && ui.host.contains(node))) { continue; }
            candidate = candidateFromElement(node);
            if (candidate) { return candidate; }
            parent = node.parentElement;
            depth = 0;
            while (parent && depth < 4) {
                candidate = candidateFromElement(parent);
                if (candidate) { return candidate; }
                parent = parent.parentElement;
                depth += 1;
            }
        }
        return null;
    }

    function candidateFromElement(element) {
        if (!element || element.nodeType !== 1) { return null; }
        var tag = String(element.tagName || '').toLowerCase();
        if (tag === 'img') { return imageCandidate(element); }
        if (tag === 'canvas') { return { kind: 'canvas', element: element, url: '', hint: element.getAttribute('aria-label') || 'canvas', source: 'canvas' }; }
        if (tag === 'svg') { return { kind: 'svg', element: element, url: '', hint: element.getAttribute('aria-label') || 'svg', source: 'svg' }; }
        var img = element.querySelector ? element.querySelector(':scope > img') : null;
        if (img) {
            var image = imageCandidate(img);
            if (image) { return image; }
        }
        return backgroundCandidate(element);
    }

    function imageCandidate(img) {
        var candidates = [];
        var current = normalizeUrl(img.currentSrc || img.src || '');
        if (settings.quality === 'current') {
            if (!current) { return null; }
            return { kind: 'url', element: img, url: current, currentUrl: current, hint: imageHint(img), source: 'current' };
        }
        addUrlCandidate(candidates, current, 1800 + imageAreaScore(img), 'current');
        addUrlCandidate(candidates, normalizeUrl(img.src || ''), 1200, 'src');
        collectSrcset(candidates, img.getAttribute('srcset'), 2200, 'img-srcset');
        collectSrcset(candidates, img.getAttribute('data-srcset'), 2300, 'data-srcset');

        var picture = img.parentElement;
        if (picture && String(picture.tagName || '').toLowerCase() === 'picture') {
            var sources = picture.querySelectorAll('source[srcset],source[data-srcset]');
            var i;
            for (i = 0; i < sources.length; i++) {
                collectSrcset(candidates, sources[i].getAttribute('srcset') || sources[i].getAttribute('data-srcset'), 2400, 'picture-srcset');
            }
        }

        var highAttrs = [
            'data-original', 'data-original-src', 'data-full', 'data-full-src', 'data-fullsize',
            'data-large', 'data-large-src', 'data-large-image', 'data-zoom-image', 'data-zoom-src',
            'data-hires', 'data-high-res', 'data-highres', 'data-src', 'data-lazy-src', 'data-lazy'
        ];
        var a;
        for (a = 0; a < highAttrs.length; a++) {
            var value = normalizeUrl(img.getAttribute(highAttrs[a]) || '');
            if (value) {
                var attrScore = /original|full|zoom|large|hires|high/i.test(highAttrs[a]) ? 3600 : 2100;
                addUrlCandidate(candidates, value, attrScore, highAttrs[a]);
            }
        }

        var anchor = img.closest ? img.closest('a[href]') : null;
        if (anchor) {
            var href = normalizeUrl(anchor.getAttribute('href') || '');
            if (href && isImageLikeUrl(href)) { addUrlCandidate(candidates, href, 5000, 'image-link'); }
        }
        if (!candidates.length) { return null; }
        candidates.sort(function (aItem, bItem) { return bItem.score - aItem.score; });
        return {
            kind: 'url',
            element: img,
            url: candidates[0].url,
            currentUrl: current,
            hint: imageHint(img),
            source: candidates[0].source
        };
    }

    function backgroundCandidate(element) {
        var image = '';
        try { image = getComputedStyle(element).backgroundImage || ''; } catch (e) { return null; }
        if (!image || image === 'none') { return null; }
        var match = /url\((['"]?)(.*?)\1\)/i.exec(image);
        if (!match || !match[2]) { return null; }
        var url = normalizeUrl(match[2]);
        if (!url) { return null; }
        return { kind: 'url', element: element, url: url, currentUrl: url, hint: element.getAttribute('aria-label') || element.getAttribute('title') || 'background-image', source: 'background-image' };
    }

    function addUrlCandidate(list, url, score, source) {
        if (!url) { return; }
        var i;
        for (i = 0; i < list.length; i++) {
            if (list[i].url === url) {
                if (score > list[i].score) {
                    list[i].score = score;
                    list[i].source = source;
                }
                return;
            }
        }
        list.push({ url: url, score: score, source: source });
    }

    function collectSrcset(list, srcset, baseScore, source) {
        if (!srcset) { return; }
        var parts = splitSrcset(srcset);
        var i;
        for (i = 0; i < parts.length; i++) {
            var part = parts[i].trim();
            if (!part) { continue; }
            var bits = part.split(/\s+/);
            var url = normalizeUrl(bits[0]);
            if (!url) { continue; }
            var descriptor = bits[1] || '';
            var score = baseScore;
            var width = /^(\d+)w$/.exec(descriptor);
            var density = /^(\d+(?:\.\d+)?)x$/.exec(descriptor);
            if (width) { score += Math.min(100000, Number(width[1])); }
            else if (density) { score += Math.round(Number(density[1]) * 1000); }
            addUrlCandidate(list, url, score, source);
        }
    }

    function splitSrcset(text) {
        if (/^\s*data:/i.test(text)) { return [text]; }
        return String(text).split(',');
    }

    function imageAreaScore(img) {
        var w = Number(img.naturalWidth || 0);
        var h = Number(img.naturalHeight || 0);
        if (!(w > 0 && h > 0)) { return 0; }
        return Math.min(1200, Math.round(Math.log(w * h + 1) * 60));
    }

    function imageHint(img) {
        return img.getAttribute('alt') || img.getAttribute('title') || img.getAttribute('aria-label') || 'image';
    }

    function normalizeUrl(value) {
        value = String(value || '').trim();
        if (!value || /^javascript:/i.test(value) || value === '#') { return ''; }
        try {
            var url = new URL(value, document.baseURI).href;
            if (/^(https?:|data:|blob:)/i.test(url)) { return url; }
        } catch (e) { return ''; }
        return '';
    }

    function isImageLikeUrl(url) {
        return CONFIG.IMAGE_EXT_RE.test(url) || /^data:image\//i.test(url) || /^blob:/i.test(url);
    }

    function qualityLabel(candidate) {
        if (!candidate) { return '当前显示图'; }
        if (candidate.kind !== 'url') { return '当前显示图'; }
        var source = String(candidate.source || '');
        var strong = /image-link|srcset|original|full|zoom|large|hires|high-res|highres/i.test(source);
        if (settings.quality === 'high' && strong && candidate.url && candidate.url !== candidate.currentUrl) { return '高清原图'; }
        if (settings.quality === 'high' && /original|full|zoom|large|hires|high-res|highres|image-link/i.test(source)) { return '高清原图'; }
        return '当前显示图';
    }

    function dimensionsObjectFromElement(candidate) {
        if (!candidate || !candidate.element) { return { width: 0, height: 0 }; }
        var el = candidate.element;
        return {
            width: Math.round(Number(el.naturalWidth || el.width || 0)),
            height: Math.round(Number(el.naturalHeight || el.height || 0))
        };
    }

    function inferOriginalExtension(candidate) {
        if (!candidate) { return ''; }
        if (candidate.kind === 'canvas') { return 'png'; }
        if (candidate.kind === 'svg') { return 'svg'; }
        var url = String(candidate.url || '');
        if (/^data:image\//i.test(url)) {
            var m = /^data:([^;,]+)/i.exec(url);
            if (m) { return mimeExtension(m[1]); }
        }
        var ext = extensionOf(filenameFromUrl(url));
        if (ext) { return ext; }
        if (candidate.element && String(candidate.element.tagName || '').toLowerCase() === 'img') {
            ext = extensionOf(filenameFromUrl(candidate.element.currentSrc || candidate.element.src || ''));
            if (ext) { return ext; }
        }
        return '';
    }

    function filenameFromUrl(url) {
        if (!url || /^data:|^blob:/i.test(url)) { return ''; }
        try {
            var parsed = new URL(url, document.baseURI);
            var path = parsed.pathname || '';
            var leaf = path.substring(path.lastIndexOf('/') + 1);
            if (!leaf) { return ''; }
            try { leaf = decodeURIComponent(leaf); } catch (e) { /* keep encoded */ }
            return leaf;
        } catch (e2) { return ''; }
    }

    function extensionOf(name) {
        var match = /\.([A-Za-z0-9]{2,5})$/.exec(String(name || ''));
        if (!match) { return ''; }
        var ext = match[1].toLowerCase();
        if (/^(jpg|jpeg|png|webp|gif|svg|avif|bmp|ico|tif|tiff)$/.test(ext)) {
            return ext === 'jpeg' ? 'jpg' : (ext === 'tiff' ? 'tif' : ext);
        }
        return '';
    }

    function mimeExtension(mime) {
        var key = String(mime || '').split(';')[0].trim().toLowerCase();
        return CONFIG.MIME_EXT[key] || '';
    }

    function normalizeExt(ext) {
        ext = String(ext || '').toLowerCase();
        if (ext === 'jpeg') { return 'jpg'; }
        if (ext === 'tiff') { return 'tif'; }
        return ext || 'jpg';
    }

    function displayExt(ext) { return String(normalizeExt(ext)).toUpperCase(); }

    function allocateDownloadBase() {
        var stamp = timestampForName(new Date());
        if (state.namingSecond !== stamp) {
            state.namingSecond = stamp;
            state.namingIndex = 0;
        } else {
            state.namingIndex += 1;
        }
        return settings.namingPrefix + '#' + stamp + (state.namingIndex > 0 ? '_' + pad(state.namingIndex) : '');
    }

    function timestampForName(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' +
            pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
    }

    function pad(value) { return value < 10 ? '0' + value : String(value); }

    function formatBytes(bytes) {
        if (!(bytes >= 0)) { return ''; }
        if (bytes >= 1073741824) { return (bytes / 1073741824).toFixed(2) + ' GB'; }
        if (bytes >= 1048576) { return (bytes / 1048576).toFixed(2) + ' MB'; }
        if (bytes >= 1024) { return (bytes / 1024).toFixed(1) + ' KB'; }
        return bytes + ' B';
    }

    function shortError(error) {
        if (!error) { return '未知错误'; }
        if (error.message) { return String(error.message); }
        return String(error);
    }

    function escapeHtml(text) {
        return String(text || '').replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }
})();
