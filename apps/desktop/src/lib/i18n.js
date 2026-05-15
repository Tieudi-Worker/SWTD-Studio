/**
 * Lightweight i18n for SWTD Studio renderer.
 *
 * Two languages: 'en' (default) and 'vi'. No dependencies — small
 * dictionary keyed by dotted paths.
 *
 * Vietnamese translation rule (per Boss): translate normal UI copy,
 * but keep specialist/product terms in English — SKU, ASIN, Listing,
 * A+, Brief, Validation, Export, Pipeline, Slot, Inspector, QC, PPC,
 * ROI, CTR, CVR, Workspace.
 *
 * Values are either a string (static) or a function (interpolated/
 * pluralised — e.g. `(n) => \`${n} dòng\``). The `t()` helper resolves
 * either form; for the function form, call site appends `(args)`.
 */

export const LANGUAGES = ['en', 'vi']

const UI_TEXT = {
  /* TopBar ─────────────────────────────────────── */
  'topbar.brand_sub':         { en: 'Operator Console',         vi: 'Bảng điều khiển vận hành' },
  'topbar.workspace_key':     { en: 'WORKSPACE',                vi: 'WORKSPACE' },
  'topbar.workspace_empty':   { en: 'No workspace',             vi: 'Chưa chọn Workspace' },
  'topbar.workspace_pick':    { en: 'Pick a workspace folder',  vi: 'Chọn thư mục Workspace' },
  'topbar.search_placeholder':{ en: 'Search SKUs, commands…',   vi: 'Tìm SKU, lệnh…' },
  'topbar.tip.settings':      { en: 'Settings',                 vi: 'Cài đặt' },
  'topbar.tip.account':       { en: 'Account',                  vi: 'Tài khoản' },
  'topbar.tip.theme_light':   { en: 'Theme: light (switch to dark)',         vi: 'Giao diện: sáng (chuyển sang tối)' },
  'topbar.tip.theme_dark':    { en: 'Theme: dark (switch to light)',         vi: 'Giao diện: tối (chuyển sang sáng)' },
  'topbar.tip.density_compact':     { en: 'Density: compact (switch to comfortable)', vi: 'Mật độ: gọn (chuyển sang thoải mái)' },
  'topbar.tip.density_comfortable': { en: 'Density: comfortable (switch to compact)', vi: 'Mật độ: thoải mái (chuyển sang gọn)' },
  'topbar.tip.lang_en':       { en: 'Language: English (switch to Vietnamese)', vi: 'Ngôn ngữ: English (chuyển sang Tiếng Việt)' },
  'topbar.tip.lang_vi':       { en: 'Language: Vietnamese (switch to English)', vi: 'Ngôn ngữ: Tiếng Việt (chuyển sang English)' },

  /* Run status (chip / statusbar word) ──────────── */
  'run.idle':       { en: 'Idle',             vi: 'Chờ' },
  'run.running':    { en: 'Running',          vi: 'Đang chạy' },
  'run.complete':   { en: 'Complete',         vi: 'Hoàn tất' },
  'run.failed':     { en: 'Failed',           vi: 'Thất bại' },
  'run.cancelled':  { en: 'Cancelled',        vi: 'Đã huỷ' },
  'run.review':     { en: 'Review',           vi: 'Chờ duyệt' },
  'run.awaiting':   { en: 'awaiting review',  vi: 'chờ duyệt' },

  /* Stepper step labels — operator terms stay English (Listing, A+, QC) */
  'step.intake':    { en: 'Intake',   vi: 'Đầu vào' },
  'step.listing':   { en: 'Listing',  vi: 'Listing' },
  'step.aplus':     { en: 'A+',       vi: 'A+' },
  'step.video':     { en: 'Video',    vi: 'Video' },
  'step.qc':        { en: 'QC',       vi: 'QC' },

  /* Stepper state words */
  'stepstate.done':    { en: 'done',    vi: 'xong' },
  'stepstate.active':  { en: 'active',  vi: 'đang xem' },
  'stepstate.running': { en: 'running', vi: 'đang chạy' },
  'stepstate.locked':  { en: 'locked',  vi: 'khoá' },
  'stepstate.error':   { en: 'error',   vi: 'lỗi' },
  'stepstate.review':  { en: 'review',  vi: 'duyệt' },
  'stepstate.idle':    { en: 'idle',    vi: 'chờ' },

  /* StatusBar shortcut labels */
  'kbd.command':    { en: 'Command',   vi: 'Lệnh' },
  'kbd.run':        { en: 'Run',       vi: 'Chạy' },
  'kbd.cancel':     { en: 'Cancel',    vi: 'Huỷ' },
  'kbd.sidebar':    { en: 'Sidebar',   vi: 'Sidebar' },
  'kbd.inspector':  { en: 'Inspector', vi: 'Inspector' },
  'kbd.drawer':     { en: 'Drawer',    vi: 'Drawer' },

  /* ActivityDrawer */
  'drawer.title':            { en: 'Activity',          vi: 'Hoạt động' },
  'drawer.no_activity':      { en: 'no activity yet',   vi: 'chưa có hoạt động' },
  'drawer.lines':            {
    en: (n) => `${n} line${n === 1 ? '' : 's'}`,
    vi: (n) => `${n} dòng`
  },
  'drawer.tip.peek':         { en: 'Peek activity',     vi: 'Xem nhanh hoạt động' },
  'drawer.tip.expand':       { en: 'Expand activity',   vi: 'Mở rộng hoạt động' },
  'drawer.tip.collapse':     { en: 'Collapse activity', vi: 'Thu gọn hoạt động' },
  'drawer.clear':            { en: 'Clear log',         vi: 'Xoá log' },
  'drawer.collapse':         { en: 'Collapse',          vi: 'Thu gọn' },
  'drawer.empty_hint':       { en: 'No log lines yet — run the pipeline to stream output.',
                               vi: 'Chưa có dòng log nào — chạy Pipeline để xem output trực tiếp.' },

  /* LeftRail */
  'leftrail.workspace':            { en: 'Workspace',            vi: 'Workspace' },
  'leftrail.section.collections':  { en: 'Collections',          vi: 'Bộ sưu tập' },
  'leftrail.section.skus':         { en: 'SKUs',                 vi: 'SKUs' },
  'leftrail.collection.all':       { en: 'All',                  vi: 'Tất cả' },
  'leftrail.collection.draft':     { en: 'Draft',                vi: 'Bản nháp' },
  'leftrail.collection.ready':     { en: 'Ready',                vi: 'Sẵn sàng' },
  'leftrail.collection.needs_fix': { en: 'Needs Fix',            vi: 'Cần sửa' },
  'leftrail.collection.complete':  { en: 'Complete',             vi: 'Hoàn tất' },
  'leftrail.filter_placeholder':   { en: 'Filter…',              vi: 'Lọc…' },
  'leftrail.empty.no_workspace':         { en: 'No workspace',          vi: 'Chưa chọn Workspace' },
  'leftrail.empty.no_workspace_hint':    { en: 'Pick a folder containing SKU subdirectories.',
                                            vi: 'Chọn thư mục chứa các SKU.' },
  'leftrail.empty.no_matches':           { en: 'No matches',            vi: 'Không có kết quả' },
  'leftrail.empty.no_matches_hint':      { en: 'Adjust the filter to find a SKU.',
                                            vi: 'Đổi bộ lọc để tìm SKU.' },
  'leftrail.empty.no_skus':              { en: 'No SKUs',               vi: 'Không có SKU' },
  'leftrail.empty.no_skus_hint':         { en: 'This folder has no SKU subdirectories.',
                                            vi: 'Thư mục này chưa có SKU nào.' },
  'leftrail.action.pick_workspace':      { en: 'Pick workspace',        vi: 'Chọn Workspace' },
  'leftrail.action.clear_filter':        { en: 'Clear filter',          vi: 'Xoá bộ lọc' },
  'leftrail.flag.has_brief':             { en: 'brief',                 vi: 'brief' },
  'leftrail.flag.no_brief':              { en: 'no brief',              vi: 'thiếu brief' },
  'leftrail.tip.collapse':               { en: 'Collapse sidebar',      vi: 'Thu gọn sidebar' },
  'leftrail.tip.expand':                 { en: 'Expand sidebar',        vi: 'Mở rộng sidebar' },
  'leftrail.tip.refresh':                { en: 'Refresh SKUs',          vi: 'Tải lại danh sách SKU' },

  /* MainCanvas — empty states + step headers */
  'canvas.empty.no_workspace':       { en: 'Pick a workspace to begin', vi: 'Chọn Workspace để bắt đầu' },
  'canvas.empty.no_workspace_hint':  { en: 'Select the parent folder containing your SKU subdirectories. Each SKU should have a brief.json.',
                                       vi: 'Chọn thư mục cha chứa các SKU. Mỗi SKU cần có file brief.json.' },
  'canvas.empty.no_sku':             { en: 'Select a SKU',              vi: 'Chọn một SKU' },
  'canvas.empty.no_sku_hint': {
    en: (n) => n > 0
      ? `${n} SKU${n === 1 ? '' : 's'} discovered. Click one in the left rail to load its brief.`
      : 'No SKUs discovered. Add SKU folders (each with brief.json) inside the workspace.',
    vi: (n) => n > 0
      ? `Đã thấy ${n} SKU. Bấm một SKU ở thanh trái để mở Brief.`
      : 'Chưa thấy SKU nào. Thêm thư mục SKU (có brief.json) trong Workspace.'
  },
  'canvas.title.intake':   { en: 'Project & brief',           vi: 'Dự án & Brief' },
  'canvas.title.listing':  { en: '8-slot listing pipeline',   vi: 'Pipeline 8 Slot Listing' },
  'canvas.title.aplus':    { en: '5-module A+ Premium pipeline', vi: 'Pipeline 5 Module A+ Premium' },
  'canvas.title.video':    { en: 'Product video',             vi: 'Product video' },
  'canvas.title.qc':       { en: 'QC & export bundle',        vi: 'QC & gói Export' },

  /* A+ pipeline */
  'aplus.panel.title':           { en: 'A+ modules',              vi: 'A+ modules' },
  'aplus.panel.subtitle':        { en: 'runtime/bin/aplus.mjs',   vi: 'runtime/bin/aplus.mjs' },
  'aplus.toolbar.no_selection':  { en: 'No modules selected',     vi: 'Chưa chọn module' },
  'aplus.toolbar.selection': {
    en: (n) => `${n} module${n === 1 ? '' : 's'} selected`,
    vi: (n) => `Đã chọn ${n} module`
  },
  'aplus.toolbar.select_all':    { en: 'Select all',              vi: 'Chọn tất cả' },
  'aplus.toolbar.clear':         { en: 'Clear',                   vi: 'Xoá' },
  'aplus.action.run_all_5':      { en: 'Run all 5',               vi: 'Chạy cả 5' },
  'aplus.action.regen_selected': { en: 'Regenerate selected',     vi: 'Regenerate đã chọn' },
  'aplus.action.regen_n': {
    en: (n) => `Regenerate ${n} module${n === 1 ? '' : 's'}`,
    vi: (n) => `Regenerate ${n} module`
  },
  'aplus.reason.select_modules': { en: 'Select one or more modules to regenerate',
                                   vi: 'Chọn ít nhất một module để Regenerate' },
  'aplus.validator.title':       { en: 'A+ output validator',     vi: 'Validator A+ output' },
  'aplus.validator.recheck':     { en: 'Re-check',                vi: 'Kiểm tra lại' },
  'aplus.validator.checking':    { en: 'Checking…',               vi: 'Đang kiểm tra…' },
  'aplus.validator.no_report':   { en: 'Run A+ or click Re-check to validate output/aplus/.',
                                   vi: 'Chạy A+ hoặc bấm Kiểm tra lại để validate output/aplus/.' },
  'aplus.validator.files_present': {
    en: (f) => `All 5 module files present (${f}/5)`,
    vi: (f) => `Đủ 5 file module (${f}/5)`
  },
  'aplus.validator.files_missing': {
    en: (f, m) => `${f}/5 found · missing ${m}`,
    vi: (f, m) => `Có ${f}/5 · thiếu ${m}`
  },
  'aplus.validator.dimensions':  { en: 'Module dimensions 1464×600', vi: 'Kích thước module 1464×600' },
  'aplus.validator.dims_unchecked': { en: 'unchecked — sharp not available in runtime',
                                       vi: 'chưa kiểm tra — sharp không khả dụng' },
  'aplus.validator.output_dir':  { en: 'Output directory',         vi: 'Thư mục output' },
  'aplus.validator.dir_missing': { en: '— folder not yet created', vi: '— chưa có thư mục' },
  'aplus.tab.run':               { en: 'Run',          vi: 'Chạy' },
  'aplus.tab.modules':           { en: 'Modules',      vi: 'Modules' },
  'aplus.tab.qc':                { en: 'QC',           vi: 'QC' },
  'aplus.inspector.run_section': { en: 'A+ run',       vi: 'Lượt chạy A+' },
  'aplus.inspector.modules_section': { en: 'Module progress', vi: 'Tiến độ module' },
  'aplus.inspector.qc_section':  { en: 'A+ output validator',  vi: 'Validator A+ output' },
  'aplus.module.state.idle':     { en: 'pending',  vi: 'chờ' },
  'aplus.module.state.running':  { en: 'live',     vi: 'đang chạy' },
  'aplus.module.state.done':     { en: 'done',     vi: 'xong' },
  'aplus.module.state.error':    { en: 'failed',   vi: 'lỗi' },
  'aplus.module.state.skipped':  { en: 'skipped',  vi: 'đã bỏ qua' },
  'aplus.qc.status_pass':        { en: 'Pass',     vi: 'Pass' },
  'aplus.qc.status_issues':      { en: 'Issues',   vi: 'Lỗi' },
  'aplus.qc.status_nodata':      { en: 'No data',  vi: 'Chưa có dữ liệu' },

  /* RightInspector tabs (kept short, ops terms in English where read better) */
  'tab.brief':       { en: 'Brief',      vi: 'Brief' },
  'tab.validation':  { en: 'Validation', vi: 'Validation' },
  'tab.history':     { en: 'History',    vi: 'Lịch sử' },
  'tab.run':         { en: 'Run',        vi: 'Chạy' },
  'tab.slots':       { en: 'Slots',      vi: 'Slots' },
  'tab.qc':          { en: 'QC',         vi: 'QC' },
  'tab.plan':        { en: 'Plan',       vi: 'Kế hoạch' },

  /* RightInspector actions + section heads */
  'inspector.section.current_sku':     { en: 'Current SKU',      vi: 'SKU hiện tại' },
  'inspector.section.brief_fields':    { en: 'Brief fields',     vi: 'Trường Brief' },
  'inspector.section.brief_health':    { en: 'Brief health',     vi: 'Tình trạng Brief' },
  'inspector.section.recent_changes':  { en: 'Recent changes',   vi: 'Thay đổi gần đây' },
  'inspector.section.listing_run':     { en: 'Listing run',      vi: 'Lượt chạy Listing' },
  'inspector.section.slot_progress':   { en: 'Slot progress',    vi: 'Tiến độ Slot' },
  'inspector.section.output_validator':{ en: 'Output validator', vi: 'Validator output' },
  'inspector.section.step_locked':     { en: 'Step locked',      vi: 'Bước bị khoá' },
  'inspector.action.run_listing':      { en: 'Run listing',      vi: 'Chạy Listing' },
  'inspector.action.run_all_8':        { en: 'Run all 8 slots',  vi: 'Chạy cả 8 Slot' },
  'inspector.action.revalidate':       { en: 'Re-validate brief',vi: 'Kiểm tra lại Brief' },
  'inspector.action.cancel':           { en: 'Cancel run',       vi: 'Huỷ lượt chạy' },
  'inspector.action.regen_selected':   { en: 'Regenerate selected', vi: 'Regenerate đã chọn' },
  'inspector.action.regen_n': {
    en: (n) => `Regenerate ${n} slot${n === 1 ? '' : 's'}`,
    vi: (n) => `Regenerate ${n} Slot`
  },
  'inspector.action.locked':           { en: 'Locked',           vi: 'Đã khoá' },
  'inspector.action.open_cohesion':    { en: 'Open Cohesion Request', vi: 'Mở Cohesion Request' },

  /* CommandPalette */
  'cmdk.placeholder':           { en: 'Type a command, navigate steps, jump to a SKU…',
                                  vi: 'Gõ lệnh, đi bước, hoặc nhảy đến SKU…' },
  'cmdk.group.navigation':      { en: 'Navigation', vi: 'Điều hướng' },
  'cmdk.group.actions':         { en: 'Actions',    vi: 'Hành động' },
  'cmdk.group.skus':            { en: 'SKUs',       vi: 'SKUs' },
  'cmdk.group.settings':        { en: 'Settings',   vi: 'Cài đặt' },
  'cmdk.empty.title': {
    en: (q) => `No matches for "${q}"`,
    vi: (q) => `Không có kết quả cho "${q}"`
  },
  'cmdk.empty.hint':            { en: 'Try a SKU name, step name, or action verb',
                                  vi: 'Thử tên SKU, tên bước, hoặc động từ hành động' },
  'cmdk.footer.navigate':       { en: 'Navigate', vi: 'Di chuyển' },
  'cmdk.footer.select':         { en: 'Select',   vi: 'Chọn' },
  'cmdk.footer.close':          { en: 'Close',    vi: 'Đóng' },
  'cmdk.action.run_listing':    { en: 'Run listing',           vi: 'Chạy Listing' },
  'cmdk.action.cancel_run':     { en: 'Cancel current run',    vi: 'Huỷ lượt chạy hiện tại' },
  'cmdk.action.revalidate':     { en: 'Re-validate brief',     vi: 'Kiểm tra lại Brief' },
  'cmdk.action.pick_workspace': { en: 'Pick workspace…',       vi: 'Chọn Workspace…' },
  'cmdk.action.toggle_sidebar': { en: 'Toggle sidebar',        vi: 'Bật/tắt sidebar' },
  'cmdk.action.toggle_inspector': { en: 'Toggle inspector',    vi: 'Bật/tắt Inspector' },
  'cmdk.action.toggle_drawer':  { en: 'Toggle activity drawer',vi: 'Bật/tắt Activity Drawer' },
  'cmdk.action.go_to':          {
    en: (label) => `Go to ${label}`,
    vi: (label) => `Đi tới ${label}`
  },
  'cmdk.action.density_to_compact':     { en: 'Density: switch to compact',     vi: 'Mật độ: chuyển sang gọn' },
  'cmdk.action.density_to_comfortable': { en: 'Density: switch to comfortable', vi: 'Mật độ: chuyển sang thoải mái' },
  'cmdk.action.theme_to_light': { en: 'Theme: switch to Light', vi: 'Giao diện: chuyển sang Sáng' },
  'cmdk.action.theme_to_dark':  { en: 'Theme: switch to Dark',  vi: 'Giao diện: chuyển sang Tối' },
  'cmdk.action.lang_to_vi':     { en: 'Language: switch to Vietnamese', vi: 'Ngôn ngữ: chuyển sang Tiếng Việt' },
  'cmdk.action.lang_to_en':     { en: 'Language: switch to English',    vi: 'Ngôn ngữ: chuyển sang English' },
  'cmdk.reason.step_locked':    { en: 'Step is locked — complete earlier steps first.',
                                  vi: 'Bước này đang khoá — hoàn thành các bước trước trước.' },
  'cmdk.reason.no_brief':       { en: 'No brief.json in this SKU folder.',
                                  vi: 'Thư mục SKU này chưa có brief.json.' },

  /* Slot canonical state words (Phase 1) ───────────────── */
  'slot.state.idle':       { en: 'pending',    vi: 'chờ' },
  'slot.state.queued':     { en: 'queued',     vi: 'đang xếp hàng' },
  'slot.state.generating': { en: 'live',       vi: 'đang chạy' },
  'slot.state.success':    { en: 'done',       vi: 'xong' },
  'slot.state.failed':     { en: 'failed',     vi: 'lỗi' },
  'slot.state.approved':   { en: 'approved',   vi: 'đã duyệt' },

  /* Slot review action labels (Phase 1) ─────────────────── */
  'slot.action.approve':       { en: '✓ OK',     vi: '✓ OK' },
  'slot.action.regen':         { en: '⚠ Regen',  vi: '⚠ Regen' },
  'slot.action.open':          { en: '⌖ Open',   vi: '⌖ Mở' },
  'slot.action.prompt':        { en: 'prompt',   vi: 'prompt' },
  'slot.prompt.placeholder':   { en: 'Optional prompt override for next regen…',
                                 vi: 'Prompt thay thế cho lần regen tiếp theo (tuỳ chọn)…' },
  'slot.prompt.saved_pending': { en: 'Saved locally · runtime support pending',
                                 vi: 'Đã lưu local · chờ runtime hỗ trợ' },

  /* Mock pipeline badge (dev-only) */
  'topbar.mock_badge':         { en: 'MOCK', vi: 'MOCK' },
  'topbar.mock_tip':           { en: 'Mock pipeline active — synthetic events, no real API calls.',
                                 vi: 'Mock pipeline đang chạy — sự kiện giả lập, không gọi API thật.' },

  /* Run timeline (Phase 1) */
  'timeline.heading':   { en: 'Run timeline',           vi: 'Tiến trình lượt chạy' },
  'timeline.empty':     { en: 'No events yet — start a run to populate.',
                          vi: 'Chưa có sự kiện — chạy Pipeline để xem.' },
  'timeline.start':     { en: 'pipeline start',         vi: 'bắt đầu pipeline' },
  'timeline.end_ok':    { en: 'finished',               vi: 'kết thúc' },
  'timeline.end_err':   { en: 'errored',                vi: 'gặp lỗi' },
  'timeline.end_paused':{ en: 'paused for review',      vi: 'tạm dừng để duyệt' },
  'timeline.end_aborted': { en: 'cancelled',            vi: 'đã huỷ' },

  /* Run timeline (tab + transition format) */
  'tab.timeline':    { en: 'Timeline', vi: 'Timeline' },
  'timeline.transition': {
    en: (slotId, fromState, toState) => `Slot ${slotId}: ${fromState} → ${toState}`,
    vi: (slotId, fromState, toState) => `Slot ${slotId}: ${fromState} → ${toState}`
  },

  /* Slot toolbar (extra Phase 1 keys) */
  'slot.toolbar.approved_count': {
    en: (approved, found) => `${approved}/${found} approved`,
    vi: (approved, found) => `${approved}/${found} đã duyệt`
  },
  'slot.toolbar.export_button': {
    en: (n) => `Export approved (${n})`,
    vi: (n) => `Export đã duyệt (${n})`
  },
  'slot.toolbar.export_flash': {
    en: (n) => `Copied ${n} path${n === 1 ? '' : 's'} ✓`,
    vi: (n) => `Đã copy ${n} đường dẫn ✓`
  },
  'slot.toolbar.reveal_folder': { en: 'Reveal output folder',
                                  vi: 'Mở thư mục output' }
}

/**
 * Resolve a key for a language. Returns the entry value if it's a
 * string, or the function for templated entries. Falls back to en,
 * then the raw key, if a translation is missing.
 *
 * @param {string} key
 * @param {'en'|'vi'} [lang]
 * @returns {string|Function}
 */
export function t(key, lang = 'en') {
  const entry = UI_TEXT[key]
  if (!entry) return key
  return entry[lang] ?? entry.en ?? key
}
