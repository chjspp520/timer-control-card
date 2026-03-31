const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class TimerControlCard extends LitElement {
  // 新增：定义常量（魔法数字常量化）
  static get CONSTANTS() {
    return {
      // 同步频率（秒）
      // 【优化】增加同步间隔，避免消息堆积
      SYNC_FREQUENCIES: {
        CRITICAL: 10,     // 最后1分钟：每10秒同步（原3秒）
        HIGH: 30,         // 1-5分钟：每30秒同步（原10秒）
        MEDIUM: 60,       // 5-10分钟：每60秒同步（原20秒）
        LOW: 120          // 大于10分钟：每120秒同步（原60秒）
      },
      // 时间阈值（秒）
      TIME_THRESHOLDS: {
        CRITICAL: 60,     // 60秒 = 1分钟
        HIGH: 300,        // 300秒 = 5分钟
        MEDIUM: 600,      // 600秒 = 10分钟
        SYNC_DIFF_CRITICAL: 2, // 2秒容忍阈值（最后1分钟）
        SYNC_DIFF_HIGH: 5,     // 5秒容忍阈值（1-5分钟）
        SYNC_DIFF_MEDIUM: 10,  // 10秒容忍阈值（5-10分钟）
        SYNC_DIFF_LOW: 10      // 10秒容忍阈值（大于10分钟）
      },
      // 其他常量
      FRAME_RATE: 16,           // 约60fps
      MAX_RETRY_DELAY: 10000,   // 最大重试延迟10秒
      SYNC_TIMEOUT: 5000,       // 同步超时5秒
      COUNTDOWN_END_DELAY: 2000 // 倒计时结束延迟2秒
    };
  }

  /**
   * 配色方案定义 - 静态属性
   * 支持多种主题：light(亮色)、dark(暗色)、black(纯黑)、darkgray(深灰)、transparent(半透明)等
   */
  static get COLOR_SCHEMES() {
    return {
      // 亮色主题方案 - 主要使用白色系
      light: {
        '--timer-card-bg': 'rgba(255, 255, 255, 0.8)',
        '--timer-card-shadow': '0 8px 32px rgba(0, 0, 0, 0.1)',
        '--timer-card-hover-shadow': '0 12px 40px rgba(0, 0, 0, 0.15)',
        '--timer-primary-text': '#000000',
        '--timer-secondary-text': 'rgba(0, 0, 0, 0.6)',
        '--timer-icon-color': 'rgba(0, 0, 0, 0.7)',
        '--timer-button-bg': 'rgba(0, 0, 0, 0.05)',
        '--timer-button-active-bg': 'rgba(0, 0, 0, 0.12)',
        '--timer-popup-bg': 'rgba(255, 255, 255, 0.98)',
        '--timer-popup-shadow': '0 20px 60px rgba(0, 0, 0, 0.15)',
        '--timer-popup-border': 'rgba(0, 0, 0, 0.1)',
        '--timer-overlay-bg': 'rgba(0, 0, 0, 0.4)',
        '--timer-input-bg': 'rgba(255, 255, 255, 0.9)',
        '--timer-input-border': 'rgba(0, 0, 0, 0.1)',
        '--timer-input-text': 'rgba(0, 0, 0, 0.8)',
        '--timer-slider-bg': 'rgba(0, 0, 0, 0.1)',
        '--timer-slider-track': 'rgba(52, 152, 219, 0.8)',
        '--timer-divider': '#f0f0f0',
        '--timer-hover-bg': '#f2f2f7',
        '--timer-active-bg': '#007aff',
        '--timer-active-text': '#ffffff',
        '--timer-accent-color': '#007aff',
        '--timer-danger-color': '#ff3b30',
        '--timer-warning-color': '#ff9500',
        '--timer-success-color': '#28a745',
        '--timer-tab-bg': '#f2f2f7',
        '--timer-tab-active-bg': '#ffffff',
        '--timer-tab-active-text': '#007aff',
        '--timer-entity-item-bg': '#ffffff',
        '--timer-entity-item-hover': '#f2f2f7',
        '--timer-empty-state-text': '#8e8e93',
        '--timer-progress-bg': '#1976d2',
        '--timer-time-display-color': '#007aff'
      },
      // 暗色主题方案 - 主要使用深色系
      dark: {
        '--timer-card-bg': 'rgba(40, 40, 40, 0.9)',
        '--timer-card-shadow': '0 8px 32px rgba(0, 0, 0, 0.3)',
        '--timer-card-hover-shadow': '0 12px 40px rgba(0, 0, 0, 0.4)',
        '--timer-primary-text': 'rgba(255, 255, 255, 0.9)',
        '--timer-secondary-text': 'rgba(255, 255, 255, 0.6)',
        '--timer-icon-color': 'rgba(255, 255, 255, 0.7)',
        '--timer-button-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-button-active-bg': 'rgba(255, 255, 255, 0.15)',
        '--timer-popup-bg': 'rgba(30, 30, 30, 0.98)',
        '--timer-popup-shadow': '0 20px 60px rgba(0, 0, 0, 0.4)',
        '--timer-popup-border': 'rgba(255, 255, 255, 0.1)',
        '--timer-overlay-bg': 'rgba(0, 0, 0, 0.6)',
        '--timer-input-bg': 'rgba(50, 50, 50, 0.9)',
        '--timer-input-border': 'rgba(255, 255, 255, 0.15)',
        '--timer-input-text': 'rgba(255, 255, 255, 0.9)',
        '--timer-slider-bg': 'rgba(255, 255, 255, 0.1)',
        '--timer-slider-track': 'rgba(52, 152, 219, 0.8)',
        '--timer-divider': 'rgba(255, 255, 255, 0.12)',
        '--timer-hover-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-active-bg': '#007aff',
        '--timer-active-text': '#ffffff',
        '--timer-accent-color': '#007aff',
        '--timer-danger-color': '#ff453a',
        '--timer-warning-color': '#ff9f0a',
        '--timer-success-color': '#30d158',
        '--timer-tab-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-tab-active-bg': 'rgba(255, 255, 255, 0.15)',
        '--timer-tab-active-text': '#007aff',
        '--timer-entity-item-bg': 'rgba(255, 255, 255, 0.05)',
        '--timer-entity-item-hover': 'rgba(255, 255, 255, 0.1)',
        '--timer-empty-state-text': 'rgba(255, 255, 255, 0.5)',
        '--timer-progress-bg': '#007aff',
        '--timer-time-display-color': '#64b5f6'
      },
      // 纯黑色主题方案
      black: {
        '--timer-card-bg': 'rgba(0, 0, 0, 0.95)',
        '--timer-card-shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
        '--timer-card-hover-shadow': '0 12px 40px rgba(0, 0, 0, 0.6)',
        '--timer-primary-text': 'rgb(255, 255, 255)',
        '--timer-secondary-text': 'rgba(255, 255, 255, 0.6)',
        '--timer-icon-color': 'rgba(255, 255, 255, 0.8)',
        '--timer-button-bg': 'rgba(255, 255, 255, 0.1)',
        '--timer-button-active-bg': 'rgba(255, 255, 255, 0.2)',
        '--timer-popup-bg': 'rgba(10, 10, 10, 0.98)',
        '--timer-popup-shadow': '0 20px 60px rgba(0, 0, 0, 0.6)',
        '--timer-popup-border': 'rgba(255, 255, 255, 0.08)',
        '--timer-overlay-bg': 'rgba(0, 0, 0, 0.7)',
        '--timer-input-bg': 'rgba(20, 20, 20, 0.95)',
        '--timer-input-border': 'rgba(255, 255, 255, 0.1)',
        '--timer-input-text': 'rgb(255, 255, 255)',
        '--timer-slider-bg': 'rgba(255, 255, 255, 0.1)',
        '--timer-slider-track': 'rgba(52, 152, 219, 0.9)',
        '--timer-divider': 'rgba(255, 255, 255, 0.1)',
        '--timer-hover-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-active-bg': '#007aff',
        '--timer-active-text': '#ffffff',
        '--timer-accent-color': '#007aff',
        '--timer-danger-color': '#ff453a',
        '--timer-warning-color': '#ff9f0a',
        '--timer-success-color': '#30d158',
        '--timer-tab-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-tab-active-bg': 'rgba(255, 255, 255, 0.15)',
        '--timer-tab-active-text': '#007aff',
        '--timer-entity-item-bg': 'rgba(255, 255, 255, 0.05)',
        '--timer-entity-item-hover': 'rgba(255, 255, 255, 0.1)',
        '--timer-empty-state-text': 'rgba(255, 255, 255, 0.5)',
        '--timer-progress-bg': '#007aff',
        '--timer-time-display-color': '#64b5f6'
      },
      // 深灰主题方案
      darkgray: {
        '--timer-card-bg': 'rgba(34, 34, 34, 0.95)',
        '--timer-card-shadow': '0 8px 32px rgba(0, 0, 0, 0.4)',
        '--timer-card-hover-shadow': '0 12px 40px rgba(0, 0, 0, 0.5)',
        '--timer-primary-text': 'rgb(255, 255, 255)',
        '--timer-secondary-text': 'rgba(255, 255, 255, 0.6)',
        '--timer-icon-color': 'rgba(255, 255, 255, 0.8)',
        '--timer-button-bg': 'rgba(255, 255, 255, 0.1)',
        '--timer-button-active-bg': 'rgba(255, 255, 255, 0.18)',
        '--timer-popup-bg': 'rgba(30, 30, 30, 0.7)',
        '--timer-popup-shadow': '0 20px 60px rgba(0, 0, 0, 0.5)',
        '--timer-popup-border': 'rgba(255, 255, 255, 0.08)',
        '--timer-overlay-bg': 'rgba(0, 0, 0, 0.6)',
        '--timer-input-bg': 'rgba(50, 50, 50, 0.95)',
        '--timer-input-border': 'rgba(255, 255, 255, 0.1)',
        '--timer-input-text': 'rgb(255, 255, 255)',
        '--timer-slider-bg': 'rgba(255, 255, 255, 0.1)',
        '--timer-slider-track': 'rgba(52, 152, 219, 0.9)',
        '--timer-divider': 'rgba(255, 255, 255, 0.1)',
        '--timer-hover-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-active-bg': '#007aff',
        '--timer-active-text': '#ffffff',
        '--timer-accent-color': '#007aff',
        '--timer-danger-color': '#ff453a',
        '--timer-warning-color': '#ff9f0a',
        '--timer-success-color': '#30d158',
        '--timer-tab-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-tab-active-bg': 'rgba(255, 255, 255, 0.15)',
        '--timer-tab-active-text': '#007aff',
        '--timer-entity-item-bg': 'rgba(255, 255, 255, 0.05)',
        '--timer-entity-item-hover': 'rgba(255, 255, 255, 0.1)',
        '--timer-empty-state-text': 'rgba(255, 255, 255, 0.5)',
        '--timer-progress-bg': '#007aff',
        '--timer-time-display-color': '#64b5f6'
      },
      // 半透明主题方案
      transparent: {
        '--timer-card-bg': 'rgba(0, 0, 0, 0.3)',
        '--timer-card-shadow': '0 8px 32px rgba(0, 0, 0, 0.3)',
        '--timer-card-hover-shadow': '0 12px 40px rgba(0, 0, 0, 0.4)',
        '--timer-primary-text': 'rgb(255, 255, 255)',
        '--timer-secondary-text': 'rgb(255, 255, 255)',
        '--timer-icon-color': 'rgba(255, 255, 255, 0.7)',
        '--timer-button-bg': 'rgba(255, 255, 255, 0.05)',
        '--timer-button-active-bg': 'rgba(255, 255, 255, 0.12)',
        '--timer-popup-bg': 'rgba(30, 30, 30, 0.85)',
        '--timer-popup-shadow': '0 20px 60px rgba(0, 0, 0, 0.4)',
        '--timer-popup-border': 'rgba(255, 255, 255, 0.1)',
        '--timer-overlay-bg': 'rgba(0, 0, 0, 0.3)',
        '--timer-input-bg': 'rgba(50, 50, 50, 0)',
        '--timer-input-border': 'rgba(255, 255, 255, 0.15)',
        '--timer-input-text': 'rgba(255, 255, 255, 0.9)',
        '--timer-slider-bg': 'rgba(255, 255, 255, 0.1)',
        '--timer-slider-track': 'rgba(52, 152, 219, 0.8)',
        '--timer-divider': 'rgba(255, 255, 255, 0.1)',
        '--timer-hover-bg': 'rgba(255, 255, 255, 0.1)',
        '--timer-active-bg': '#007aff',
        '--timer-active-text': '#ffffff',
        '--timer-accent-color': '#007aff',
        '--timer-danger-color': '#ff453a',
        '--timer-warning-color': '#ff9f0a',
        '--timer-success-color': '#30d158',
        '--timer-tab-bg': 'rgba(255, 255, 255, 0.08)',
        '--timer-tab-active-bg': 'rgba(255, 255, 255, 0.18)',
        '--timer-tab-active-text': '#007aff',
        '--timer-entity-item-bg': 'rgba(255, 255, 255, 0.05)',
        '--timer-entity-item-hover': 'rgba(255, 255, 255, 0.12)',
        '--timer-empty-state-text': 'rgba(255, 255, 255, 0.5)',
        '--timer-progress-bg': '#007aff',
        '--timer-time-display-color': '#64b5f6'
      }
    };
  }

  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _timer: { type: Object },
      _showSettings: { type: Boolean },
      _duration: { type: String },
      _remainingSeconds: { type: Number },
      _progress: { type: Number },
      _timerInfo: { type: Object },
      _isVisible: { type: Boolean },
      _retryCount: { type: Number },  // 新增：重试计数
      _activeTimersList: { type: Array }  // 新增：正在执行的任务列表
    };
  }

  constructor() {
    super();
    this._timer = null;
    this._timerInfo = null;
    this._showSettings = false;
    this._duration = "00:30:00";
    this._remainingSeconds = 0;
    this._progress = 100;
    this._countdownInterval = null;
    this._totalSeconds = 0;
    this._lastSyncTime = 0;
    this._lastSyncSuccessTime = 0;
    this._timerStartTime = 0; // 记录任务开始时间，用于补偿网络延迟
    this._isSyncing = false; // 同步状态标志，防止重复请求
    this._isVisible = false;
    this._visibilityObserver = null;
    this._retryCount = 0;
    this._maxRetries = 3;
    this._activeTimersList = [];
    this._searchKeyword = '';
    this._showSearchDropdown = false;
    this._selectedCategory = 'lights';
    this._timerMode = 'countdown';
    this._activeTimersCount = 0;
    this._eventListeners = [];
    this._showTaskList = false;
    this._showHistory = false;  // 新增：是否显示历史记录
    this._historyFilter = 'all';  // 新增：历史记录筛选条件（all/success/failed/cancelled/unknown）
    this._currentTaskIndex = 0;
    this._scrollTimeout = null;
    this._recurringInterval = 'daily';
    this._recurringDays = [];
    this._monthlyDropdownOpen = false;
    this._selectedMonthlyDay = null;
    this._deviceSectionExpanded = false;
    this._selectedHours = 0;
    this._selectedMinutes = 30;
    this._pickerDefaultDuration = '00:30:00';
    this._activeSchedulesList = [];
    
    // 新增：空调相关状态
    this._selectedClimateMode = 'cool'; // 默认空调模式
    this._selectedTemperature = 24; // 默认温度

    // 新增：窗帘相关状态
    this._selectedCoverAction = 'close'; // 默认窗帘动作
    this._selectedCoverPosition = 50; // 默认窗帘位置（百分比）
    this._coverInitialized = false; // 窗帘是否已初始化的标志

    // 新增：普通实体动作选择（light, switch, input_boolean等）
    this._selectedAction = 'auto'; // 'auto' | 'turn_on' | 'turn_off' | 'toggle'

    // 新增：防抖和节流相关
    this._updateQueued = false;
    this._updateTimeout = null;
    this._lastUpdateTime = 0;
    this._lastRefreshTime = 0; // 刷新时间戳
    // 【优化】_updateDelay 已移至上方统一配置为250ms
    
    // 新增：虚拟滚动相关
    this._itemHeight = 30; // 每个任务项的高度
    this._containerHeight = 0;
    this._visibleRange = { start: 0, end: 0 };
    
    // 【优化】增加渲染频率控制，从16ms(60fps)改为250ms(4fps)，降低CPU占用
    this._updateDelay = 250; // 约4fps，足够倒计时显示
    
    // 新增：后台同步控制
    this._isBackgroundUpdateAllowed = true;

    // 新增：超时定时器集合（用于内存泄漏修复）
    this._pendingTimeouts = new Set();
    
    // 新增：事件订阅句柄（用于清理事件订阅）
    this._eventSubscription = null;

    // 新增：外部弹窗元素引用（渲染到 document.body）
    this._externalPopup = null;       // 设置弹窗
    this._externalTaskListPopup = null; // 任务列表弹窗
    this._popupStylesInjected = false; // 样式是否已注入

    // 新增：主题相关状态
    this._themeConfig = null;         // 主题配置
    this._currentTheme = 'light';     // 当前主题名称
    this._themeTimer = null;          // 主题定时器（用于时间切换）
    this._systemThemeMediaQuery = null; // 系统主题媒体查询
    this._lastThemeName = null;       // 上次主题名称
    this._lastThemeEntityState = null; // 上次主题实体的状态值
    this._darkLightTheme = 'dark,light'; // 暗亮主题配置

    // 绑定事件处理函数
    this.handleBackendResponse = this.handleResponse.bind(this);
  }

  // 新增：安全的 setTimeout（防止内存泄漏）
  setTimeoutSafe(callback, delay, ...args) {
    const timeoutId = setTimeout(() => {
      this._pendingTimeouts.delete(timeoutId);
      callback.apply(this, args);
    }, delay);
    this._pendingTimeouts.add(timeoutId);
    return timeoutId;
  }

  // 新增：批量更新（减少多次触发）
  batchUpdate(updates) {
    let shouldUpdate = false;
    
    Object.keys(updates).forEach(key => {
      if (this[key] !== updates[key]) {
        this[key] = updates[key];
        shouldUpdate = true;
      }
    });
    
    if (shouldUpdate) {
      this.requestUpdateDebounced();
    }
  }

  // 新增：防抖的 requestUpdate 方法
  requestUpdateDebounced() {
    const now = Date.now();
    
    // 如果已经安排了更新，则忽略新的请求
    if (this._updateTimeout) {
      return;
    }
    
    // 计算距离上次更新的时间
    const timeSinceLastUpdate = now - this._lastUpdateTime;
    
    // 如果距离上次更新太近，则延迟更新
    if (timeSinceLastUpdate < this._updateDelay) {
      this._updateTimeout = this.setTimeoutSafe(() => {
        this._performUpdate();
      }, this._updateDelay - timeSinceLastUpdate);
    } else {
      // 否则立即更新
      this._performUpdate();
    }
  }

  // 新增：执行实际更新
  _performUpdate() {
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
      this._updateTimeout = null;
    }
    
    this._lastUpdateTime = Date.now();
    this.requestUpdate();
  }

  // 新增：计算虚拟滚动的可见范围
  calculateVisibleRange(scrollTop = 0, containerHeight = 0, itemHeight = 30, buffer = 2) {
    const totalItems = this._activeTimersList?.length || 0;
    
    if (totalItems === 0) {
      return { start: 0, end: 0 };
    }
    
    // 如果容器高度不够，至少显示一个任务
    if (containerHeight <= 0) {
      return { start: 0, end: Math.min(1, totalItems) };
    }
    
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const end = Math.min(totalItems, start + visibleCount + buffer * 2);
    
    return { start, end };
  }

  setConfig(config) {
    this.config = {
      entity: config.entity,
      default_duration: config.default_duration || '00:30:00',
      // 卡片样式配置
      card_style: config.card_style || 'mini', // 'mini' 或 'normal'
      // second_style 配置：当为 'pull-down' 且 card_style 为 'mini' 时，点击时间框弹出时间选择器
      second_style: config.second_style || 'normal',
      // time-box 自定义配置
      time_box_font_size: config.time_box_font_size || '20px',
      time_box_width: config.time_box_width || 'auto',
      time_box_height: config.time_box_height || 'auto',
      time_box_background: config.time_box_background || '#f8f9fa',
      time_box_progress_background: config.time_box_progress_background || '#1976d2',
      // 定时器边框配置
      timer_running_border: config.timer_running_border || '1px solid #1976d2',
      // 状态指示器自定义配置
      status_indicator_color: config.status_indicator_color || '#28a745',
      status_indicator_width: config.status_indicator_width || '6px',
      status_indicator_height: config.status_indicator_height || '6px',
      // 按钮自定义配置
      start_btn_color: config.start_btn_color || '#28a745',
      start_btn_width: config.start_btn_width || 'auto',
      start_btn_height: config.start_btn_height || 'auto',
      cancel_btn_color: config.cancel_btn_color || '#dc3545',
      cancel_btn_width: config.cancel_btn_width || 'auto',
      cancel_btn_height: config.cancel_btn_height || 'auto',
      // 按钮显示控制
      show_buttons: config.show_buttons !== undefined ? config.show_buttons : true,
      // 调试信息显示控制
      show_debug: config.show_debug === true,
      // normal样式高度配置
      normal_height: config.normal_height || '100px',
      // normal样式背景色配置（不设置时使用主题的 --timer-card-bg）
      normal_background: config.normal_background || undefined,
      ...config
    };
    
    this._duration = this.config.default_duration;
    this._selectedEntity = this.config.entity;
    
    // 初始化时间选择器的默认时长和选中值
    this._pickerDefaultDuration = this.config.default_duration || '00:30:00';
    const [hours, minutes] = this._pickerDefaultDuration.split(':').map(Number);
    this._selectedHours = hours !== undefined ? hours : 0;
    this._selectedMinutes = minutes !== undefined ? minutes : 30;
    
    // 根据card_style设置设备选择区域的初始展开状态
    if (this.config.card_style === 'normal') {
      this._deviceSectionExpanded = true; // normal模式默认展开
    } else if (this.config.card_style === 'mini' && this.config.entity) {
      this._deviceSectionExpanded = false; // mini模式且entity有值时默认折叠
    } else {
      this._deviceSectionExpanded = true; // 其他情况默认展开
    }
    
    // 新增：主题配置读取
    this._themeConfig = config.theme || null;
    this._darkLightTheme = config.dark_light_theme || 'dark,light';
    
    // 初始化主题（在 hass 准备好后会自动应用）
    this._initThemeFromConfig();
    
    // 如果已经有hass对象，立即同步并加载实体列表
    if (this.hass && this.hass.connection) {
      this._hassReady = true;
      this.loadAvailableEntities();
      this.syncImmediately();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    
    // 监听后端响应事件 - 通过Home Assistant WebSocket连接
    this.setupHassEventListener();
    
    // 同时设置window事件监听作为备用
    this.setupWindowEventListener();
    
    // 启动可见性观察
    this.setupVisibilityObserver();
    
    // 启动倒计时循环（优化：延迟启动，等待首次同步完成）
    // this.startCountdownLoop(); // 改为在首次同步后按需启动
    
    // 启动轮询机制（优化：只在有任务时启动）
    // this.startPollingLoop(); // 改为按需启动
    
    // 新增：初始化主题
    this._initTheme();
    
    // 立即尝试同步定时器状态（不等待hass就绪）
    if (this.config?.entity) {
      this.setTimeoutSafe(() => {
        this.forceSyncTimers();
      }, 500);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // 清理 window 事件监听器
    if (this._eventListeners) {
      this._eventListeners.forEach(([eventName, handler]) => {
        window.removeEventListener(eventName, handler);
      });
      this._eventListeners = [];
    }
    
    // 停止统一时间控制器（已整合所有倒计时逻辑：普通定时器、周期任务）
    this.stopUnifiedTimerController();
    
    // 停止可见性观察
    this.stopVisibilityObserver();
    
    // 清除所有超时定时器（内存泄漏修复）
    this.clearAllTimeouts();
    
    // 【移除】3D滚动已改为普通CSS滚动，不再需要JS控制
    // this.stop3DAutoScroll();
    
    // 【已整合】stopScheduleUpdate 不再需要，周期任务更新已整合到统一控制器
    
    // 取消 Home Assistant 事件订阅（防止泄漏）
    if (this._eventSubscription) {
      this._eventSubscription.then(unsub => {
        if (typeof unsub === 'function') {
          unsub();
        }
      }).catch(() => {});
      this._eventSubscription = null;
    }
    
    // 清理主题资源
    this._cleanupTheme();
    
    // 清理外部弹窗元素（渲染到 document.body 的弹窗）
    this._removeExternalPopups();
  }

  // 新增：清除所有超时定时器
  clearAllTimeouts() {
    this._pendingTimeouts.forEach(id => clearTimeout(id));
    this._pendingTimeouts.clear();
    
    // 清理特定的超时变量
    if (this._syncTimeout) {
      clearTimeout(this._syncTimeout);
      this._syncTimeout = null;
    }
    
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout);
      this._scrollTimeout = null;
    }
    
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
      this._updateTimeout = null;
    }
  }

  // 新增：安全发送事件
  async sendEventSafe(eventData) {
    try {
      if (!this.hass) {
        throw new Error('Hass对象未初始化');
      }
      
      if (!this.hass.connection) {
        throw new Error('WebSocket连接不可用');
      }
      
      // 使用原始sendMessage，因为sendMessagePromise可能不存在
      this.hass.connection.sendMessage({
        type: 'fire_event',
        event_type: 'timer_backend_event',
        event_data: eventData
      });
      
      return true;
      
    } catch (error) {
      this._debugInfo = `发送失败: ${error.message}`;
      throw error;
    }
  }

  // 新增：安全刷新定时器
  async refreshTimersSafe() {
    // 【优化】添加防重复机制，避免短时间内重复发送请求
    const now = Date.now();
    if (this._isSyncing && now - this._lastSyncTime < 5000) {
      // 正在同步且距离上次同步不足5秒，跳过
      return false;
    }

    this._isSyncing = true;
    this._lastSyncTime = now;

    try {
      await this.sendEventSafe({
        action: 'get_all_timers',
        user_id: 'user'
      });

      return true;

    } catch (error) {
      this._debugInfo = `刷新失败: ${error.message}`;
      throw error;
    } finally {
      // 5秒后重置同步标志
      this.setTimeoutSafe(() => {
        this._isSyncing = false;
      }, 5000);
    }
  }

  // 新增：强制同步定时器（不等待hass就绪）
  async forceSyncTimers() {
    try {
      // 移除正常状态的debug信息更新

      // 检查连接状态
      if (!this.hass || !this.hass.connection) {
        this._debugInfo = '等待Hass连接...';
        this._lastSyncFailed = true;
        this.setTimeoutSafe(() => this.forceSyncTimers(), 1000);
        return;
      }

      // 检查事件监听器是否设置
      if (!this._hassReady) {
        this.setupHassEventListener();
      }

      // 总是发送同步请求，不依赖活跃任务检查
      // 重启或首次加载时需要从后端获取任务列表
      this.hass.connection.sendMessage({
        type: 'fire_event',
        event_type: 'timer_backend_event',
        event_data: {
          action: 'get_all_timers',
          user_id: 'user'
        }
      });

    } catch (error) {
      this._debugInfo = `强制同步失败: ${error.message}`;
      this._lastSyncFailed = true;
      // 总是重试，不依赖活跃任务检查
      this.setTimeoutSafe(() => this.forceSyncTimers(), 2000);
    }
  }

  // 新增：加载可用实体
  loadAvailableEntities() {
    if (!this.hass || !this.hass.states) {
      this.setTimeoutSafe(() => this.loadAvailableEntities(), 1000);
      return;
    }

    const entities = Object.keys(this.hass.states);
    const categorizedEntities = {
      lights: [],
      climate: [],
      cover: [],
      fan: [],
      media: [],
      switch: [],
      input: []
    };

    entities.forEach(entityId => {
      const entity = this.hass.states[entityId];
      const friendlyName = entity.attributes?.friendly_name || entityId;
      
      // 过滤掉所有 browser mod 集成提供的实体
      const isBrowserModEntity = entityId.includes('browser_mod_') || 
                                  entityId.includes('browser.') ||
                                  entityId.includes('291987bb_55b6b42e') ||
                                  (entity.attributes && entity.attributes.integration === 'browser_mod');
      
      if (isBrowserModEntity) {
        return; // 跳过 browser mod 实体
      }
      
      // 灯光过滤：排除指示灯、screen、氛围灯、led、背光灯
      if (entityId.startsWith('light.')) {
        const excludeKeywords = ['指示灯', 'screen', '氛围灯', 'led', '背光灯'];
        const shouldExclude = excludeKeywords.some(keyword => 
          friendlyName.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!shouldExclude) {
          categorizedEntities.lights.push({
            id: entityId,
            name: friendlyName
          });
        }
      } 
      // 气候：包括climate和humidifier类型
      else if (entityId.startsWith('climate.') || entityId.startsWith('humidifier.')) {
        categorizedEntities.climate.push({
          id: entityId,
          name: friendlyName
        });
      } 
      // 风扇：fan类型
      else if (entityId.startsWith('fan.')) {
        categorizedEntities.fan.push({
          id: entityId,
          name: friendlyName
        });
      } 
      // 媒体：过滤掉状态为unavailable的实体
      else if (entityId.startsWith('media_player.')) {
        if (entity.state !== 'unavailable') {
          categorizedEntities.media.push({
            id: entityId,
            name: friendlyName
          });
        }
      }
      // 开关：switch类型，过滤掉指示灯、led
      else if (entityId.startsWith('switch.')) {
        const excludeKeywords = ['指示灯', 'led'];
        const shouldExclude = excludeKeywords.some(keyword => 
          friendlyName.toLowerCase().includes(keyword.toLowerCase())
        );
        if (!shouldExclude) {
          categorizedEntities.switch.push({
            id: entityId,
            name: friendlyName
          });
        }
      }
      // 虚拟实体：input_boolean类型
      else if (entityId.startsWith('input_boolean.')) {
        categorizedEntities.input.push({
          id: entityId,
          name: friendlyName
        });
      }
      // 窗帘：cover类型
      else if (entityId.startsWith('cover.')) {
        if (entity.state !== 'unavailable') {
          categorizedEntities.cover.push({
            id: entityId,
            name: friendlyName
          });
        }
      }
    });

    this._availableEntities = categorizedEntities;
  }

  // 新增：获取空调实体信息
  getClimateEntityInfo(entityId) {
    if (!this.hass || !this.hass.states || !entityId) {
      return null;
    }

    const entity = this.hass.states[entityId];
    if (!entity || !entityId.startsWith('climate.')) {
      return null;
    }

    return {
      hvac_modes: entity.attributes?.hvac_modes || [],
      min_temp: entity.attributes?.min_temp || 16,
      max_temp: entity.attributes?.max_temp || 30,
      target_temp_step: entity.attributes?.target_temp_step || 1,
      current_temperature: entity.attributes?.current_temperature,
      icon: entity.attributes?.icon || 'mdi:air-conditioner'
    };
  }

  // 新增：获取窗帘实体信息
  getCoverEntityInfo(entityId) {
    if (!this.hass || !this.hass.states || !entityId) {
      return null;
    }

    const entity = this.hass.states[entityId];
    if (!entity || !entityId.startsWith('cover.')) {
      return null;
    }

    return {
      state: entity.state || 'closed',
      current_position: entity.attributes?.current_position || 0,
      supported_features: entity.attributes?.supported_features || 0,
      icon: entity.attributes?.icon || 'mdi:window-closed'
    };
  }


  // 新增：获取空调模式图标
  getClimateModeIcon(mode) {
    const iconMap = {
      'auto': 'mdi:autorenew',
      'cool': 'mdi:snowflake',
      'heat': 'mdi:fire',
      'dry': 'mdi:water-percent',
      'fan_only': 'mdi:fan',
      'off': 'mdi:power'
    };
    return iconMap[mode] || 'mdi:thermostat';
  }

  // 新增：获取空调模式名称
  getClimateModeName(mode) {
    const nameMap = {
      'auto': '自动',
      'cool': '制冷',
      'heat': '制热',
      'dry': '除湿',
      'fan_only': '送风',
      'off': '关闭'
    };
    return nameMap[mode] || mode;
  }

  // 新增：按照指定顺序对空调模式进行排序
  sortClimateModes(modes) {
    const sortOrder = ['off', 'auto', 'cool', 'heat', 'dry', 'fan_only'];
    
    // 过滤出存在的模式，并按照指定顺序排序
    const sortedModes = modes.sort((a, b) => {
      const indexA = sortOrder.indexOf(a);
      const indexB = sortOrder.indexOf(b);
      
      // 如果两个模式都在排序列表中，按照排序列表顺序
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // 如果只有一个在排序列表中，排序列表中的排在前面
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // 如果两个都不在排序列表中，保持原始顺序
      return 0;
    });
    
    return sortedModes;
  }

  // 新增：更新温度显示位置
  updateTemperatureDisplayPosition() {
    // 优先从外部弹窗查找元素（弹窗渲染到 document.body）
    let rootElement = null;
    if (this._externalPopup) {
      rootElement = this._externalPopup.querySelector('.timer-popup');
    }
    if (!rootElement && this.shadowRoot) {
      rootElement = this.shadowRoot;
    }
    if (!rootElement) return;

    // 使用正确的选择器（timer- 前缀）
    const displayElement = rootElement.querySelector('.timer-temperature-display') || rootElement.querySelector('.temperature-display');
    if (!displayElement) return;

    const sliderElement = rootElement.querySelector('.timer-temperature-slider') || rootElement.querySelector('.temperature-slider');
    if (!sliderElement) return;

    // 获取空调实体信息
    const climateInfo = this.getClimateEntityInfo(this._selectedEntity);
    if (!climateInfo) return;

    // 确保滑块的值与当前温度一致（修复切换实体时的bug）
    if (sliderElement.value !== String(this._selectedTemperature)) {
      sliderElement.value = this._selectedTemperature;
    }

    // 计算温度的百分比位置（0-1）
    const temperatureRatio = (this._selectedTemperature - climateInfo.min_temp) / (climateInfo.max_temp - climateInfo.min_temp);

    // 滑块手柄宽度
    const thumbWidth = 40;

    // 获取slider元素的实际宽度
    const sliderRect = sliderElement.getBoundingClientRect();
    const sliderWidth = sliderRect.width;

    // 检查宽度是否有效（防止DOM未渲染完成）
    if (!sliderWidth || sliderWidth < 10) {
      return;
    }

    // 计算可滑动的范围（减去手柄宽度）
    const availableWidth = sliderWidth - thumbWidth;

    // 计算手柄中心位置
    const thumbCenter = (availableWidth * temperatureRatio) + (thumbWidth / 2);

    // 转换为百分比
    const leftPercentage = (thumbCenter / sliderWidth) * 100;

    // 限制在合理范围内（防止计算错误导致溢出）
    const clampedPercentage = Math.max(0, Math.min(100, leftPercentage));

    // 设置位置
    displayElement.style.left = `${clampedPercentage}%`;
  }

  // 新增：更新窗帘位置显示位置
  updateCoverDisplayPosition() {
    let rootElement = null;
    if (this._externalPopup) {
      rootElement = this._externalPopup.querySelector('.timer-popup');
    }
    if (!rootElement && this.shadowRoot) {
      rootElement = this.shadowRoot;
    }
    if (!rootElement) return;

    // 使用正确的选择器（timer- 前缀）
    const displayElement = rootElement.querySelector('.timer-position-display') || rootElement.querySelector('.position-display');
    if (!displayElement) return;

    const sliderElement = rootElement.querySelector('#cover-position-slider');
    if (!sliderElement) return;

    // 确保滑块的值与当前位置一致
    if (sliderElement.value !== String(this._selectedCoverPosition)) {
      sliderElement.value = this._selectedCoverPosition;
    }

    // 计算位置的百分比（0-1）
    const positionRatio = this._selectedCoverPosition / 100;

    // 滑块手柄宽度
    const thumbWidth = 40;

    // 获取slider元素的实际宽度
    const sliderRect = sliderElement.getBoundingClientRect();
    const sliderWidth = sliderRect.width;

    // 检查宽度是否有效（防止DOM未渲染完成）
    if (!sliderWidth || sliderWidth < 10) {
      return;
    }

    // 计算可滑动的范围（减去手柄宽度）
    const availableWidth = sliderWidth - thumbWidth;

    // 计算手柄中心位置
    const thumbCenter = (availableWidth * positionRatio) + (thumbWidth / 2);

    // 转换为百分比
    const leftPercentage = (thumbCenter / sliderWidth) * 100;

    // 限制在合理范围内（防止计算错误导致溢出）
    const clampedPercentage = Math.max(0, Math.min(100, leftPercentage));

    // 设置位置
    displayElement.style.left = `${clampedPercentage}%`;
  }

  // 新增：颜色转换方法 - 将十六进制颜色转换为RGB格式
  hexToRgb(hex) {
    // 移除#号
    hex = hex.replace(/^#/, '');
    
    // 处理3位和6位十六进制颜色
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return null;
    }
    
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
  }

  // 新增：带重试的刷新定时器
  refreshTimersWithRetry() {
    if (!this._hassReady) {
      this.setTimeoutSafe(() => this.refreshTimersWithRetry(), 1000);
      return;
    }

    this._retryCount = 0;
    this.performRefreshWithRetry();
  }

  // 新增：执行带重试的刷新
  async performRefreshWithRetry() {
    if (this._retryCount >= this._maxRetries) {
      this._debugInfo = '后端无响应，请检查后端服务';
      this._backendConnected = false;
      this._lastSyncFailed = true;  // 标记同步失败
      return;
    }
    
    this._retryCount++;
    // 移除正常状态的debug信息更新
    
    try {
      await this.refreshTimersSafe();

      // 设置超时检查，如果5秒内没收到响应且仍有活跃任务，再次尝试
      this._syncTimeout = this.setTimeoutSafe(() => {
        // 只在有活跃任务时才重试，避免无限循环
        if (!this._timerInfo && this._isVisible && this._hasActiveTasks()) {
          this.performRefreshWithRetry();
        }
      }, TimerControlCard.CONSTANTS.SYNC_TIMEOUT);
      
    } catch (error) {
      this._debugInfo = `刷新失败: ${error.message}`;
      this._lastSyncFailed = true;  // 标记同步失败
      
      // 指数退避重试
      const delay = Math.min(1000 * Math.pow(2, this._retryCount), TimerControlCard.CONSTANTS.MAX_RETRY_DELAY);
      this.setTimeoutSafe(() => {
        this.performRefreshWithRetry();
      }, delay);
    }
  }

  setupHassEventListener() {
    // 设置 Home Assistant 事件监听器
    if (this.hass && this.hass.connection) {
      try {
        // 先取消旧的订阅，防止重复订阅
        if (this._eventSubscription) {
          this._eventSubscription.then(unsub => {
            if (typeof unsub === 'function') {
              unsub();
            }
          }).catch(() => {});
          this._eventSubscription = null;
        }

        // 保存订阅句柄，用于后续清理
        this._eventSubscription = this.hass.connection.subscribeEvents((event) => {
          this.handleResponse(event);
        }, 'timer_backend_response');
      } catch (error) {

        // 备用方案：使用window事件监听
        this.setupWindowEventListener();
      }
    } else {
      // 如果hass还未准备好，延迟设置
      this.setTimeoutSafe(() => this.setupHassEventListener(), 1000);
    }
  }

  setupWindowEventListener() {
    // 备用方案：使用window事件监听
    window.addEventListener('timer_backend_response', this.handleResponse);
    this._eventListeners.push(['timer_backend_response', this.handleResponse]);
  }

  setupVisibilityObserver() {
    // 使用 IntersectionObserver 检测卡片是否可见
    if ('IntersectionObserver' in window) {
      this._visibilityObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            this._isVisible = entry.isIntersecting;
            
            if (this._isVisible) {
              // 卡片变为可见时
              // 【优化】生产环境移除console.log
              // console.log('卡片变为可见，恢复更新');
              
              // 恢复后台更新标志
              this._isBackgroundUpdateAllowed = true;

              // 【优化】移除立即同步，等待统一控制器定期同步
              // 避免短时间内发送大量同步请求导致消息堆积

              // 启动统一时间控制器（替代多个独立的start方法）
              if (this._hasActiveTasks() && !this._unifiedInterval) {
                this.startUnifiedTimerController();
              }
              
              // 【移除】3D滚动已改为普通CSS滚动，不再需要JS控制
            } else {
              // 卡片不可见时
              // 【优化】生产环境移除console.log
              // console.log('卡片变为不可见，暂停更新');
              
              // 停止统一时间控制器（已整合所有倒计时逻辑）
              this.stopUnifiedTimerController();
              // 【移除】3D滚动已改为普通CSS滚动，不再需要JS控制
              // 【已整合】stopScheduleUpdate 不再需要，周期任务更新已整合到统一控制器
              
              // 清除所有超时（使用统一的清理方法）
              this.clearAllTimeouts();
            }
          });
        },
        {
          threshold: 0, // 改为0，只要任何部分可见就视为可见
          rootMargin: '0px' // 移除预加载区域，精确控制
        }
      );
      
      // 开始观察
      this.setTimeoutSafe(() => {
        if (this.shadowRoot) {
          const container = this.shadowRoot.querySelector('.container');
          if (container && this._visibilityObserver) {
            this._visibilityObserver.observe(container);
          }
        }
      }, 100);
    }
  }

  // 新增：检查是否有活跃任务
  _hasActiveTasks() {
    return (this._activeTimersList && this._activeTimersList.length > 0) ||
           (this._activeSchedulesList && this._activeSchedulesList.length > 0) ||
           this._timerInfo !== null;
  }

  stopVisibilityObserver() {
    if (this._visibilityObserver) {
      this._visibilityObserver.disconnect();
      this._visibilityObserver = null;
    }
  }

  syncImmediately() {
    if (!this._hassReady) {
      return;
    }
    // 【优化】使用 refreshTimersSafe 而不是 refreshTimersWithRetry
    // 这样可以使用防重复机制，避免频繁同步
    // 重启或首次加载时需要从后端获取任务列表
    this.refreshTimersSafe();
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // 如果每月下拉框处于打开状态，重新定位它
    if (this._monthlyDropdownOpen) {
      this.setTimeoutSafe(() => {
        this.positionMonthlyDropdown();
      }, 10);
    }
    
    // 更新温度显示位置（延迟执行，确保DOM完全渲染）
    if (this._selectedEntity && this._selectedEntity.startsWith('climate.')) {
      this.setTimeoutSafe(() => {
        this.updateTemperatureDisplayPosition();
      }, 100);
    }

    // 更新窗帘位置显示位置（延迟执行，确保DOM完全渲染）
    if (this._selectedEntity && this._selectedEntity.startsWith('cover.')) {
      this.setTimeoutSafe(() => {
        this.updateCoverDisplayPosition();
      }, 100);
    }
    
    // 当hass对象变为可用时，立即同步
    if (changedProperties.has('hass') && this.hass) {
      // 移除正常状态的debug信息更新
      
      // 新增：检查主题实体状态是否变化，实时响应主题变化
      if (this._themeConfig) {
        this._updateThemeFromEntity();
      }
      
      // 等待连接建立
      this.setTimeoutSafe(() => {
        if (this.hass && this.hass.connection) {
          this._hassReady = true;


          // 设置事件监听器
          this.setupHassEventListener();

          // 加载可用实体
          this.loadAvailableEntities();

          // 立即同步一次（获取任务列表）
          this.syncImmediately();

          // 启动统一时间控制器（在同步之后启动）
          // 同步完成后，_activeTimersList 会被填充，此时启动控制器
          this.setTimeoutSafe(() => {
            if (!this._unifiedInterval) {
              this.startUnifiedTimerController();
            }
          }, 1500); // 延迟1.5秒，等待同步完成
        }
      }, 1000);
    }
  }

  // 统一时间控制器（合并 countdown、polling、sync）
  startUnifiedTimerController() {
    this.stopUnifiedTimerController();
    
    // 如果没有活跃任务，不启动
    if (!this._hasActiveTasks()) {
      return;
    }
    
    // 【优化】生产环境移除console.log
    // console.log('启动统一时间控制器');

    let tickCount = 0;

    this._unifiedInterval = setInterval(() => {
      tickCount++;
      const now = Date.now();

      // 检查是否需要停止
      if (!this._hasActiveTasks()) {
        // 【优化】生产环境移除console.log
        // console.log('检测到没有活跃任务，停止统一时间控制器');
        this.stopUnifiedTimerController();
        return;
      }

      // 1. 每秒更新倒计时（tickCount % 1 === 0，每秒执行）
      // 【修复】只要有活跃任务就更新，不限于当前选中的实体
      if (this._timerInfo || this._activeTimersList?.length > 0) {
        this.updateCountdown();
      }

      // 2. 更新周期任务倒计时（每秒执行）
      if (this._activeSchedulesList.length > 0 || this._activeTimersList?.some(t => t.is_schedule)) {
        this.updateScheduleCountdowns();
      }

      // 3. 智能同步（根据剩余时间动态调整频率）
      // 【优化】移除紧急同步和定期检查，只保留这一个同步点
      // 增加最小同步间隔为5秒，避免消息堆积
      const syncFrequency = this.getSmartSyncFrequency();
      if (tickCount % syncFrequency === 0) {
        if (this._isVisible && this._hassReady && this._hasActiveTasks()) {
          // 检查冷却时间，避免频繁同步（至少间隔5秒）
          if (now - this._lastSyncTime >= 5000) {
            this.refreshTimersSafe();
          }
        }
      }

      // 重置计数器，防止溢出
      if (tickCount >= 60) {
        tickCount = 0;
      }
    }, 1000);
  }

  // 停止统一时间控制器
  stopUnifiedTimerController() {
    if (this._unifiedInterval) {
      clearInterval(this._unifiedInterval);
      this._unifiedInterval = null;
      // 【优化】生产环境移除console.log
      // console.log('统一时间控制器已停止');
    }
  }

  // 更新倒计时 - 整合所有倒计时逻辑到统一时间控制器
  updateCountdown() {
    let hasUpdate = false;
    
    // 1. 更新当前选中实体的倒计时 - 优先使用 end_time 计算，避免时间跳动
    if (this._timerInfo) {
      if (this._timerInfo.end_time) {
        // 有 end_time：基于准确时间计算
        const now = Date.now();
        const endTime = new Date(this._timerInfo.end_time).getTime();
        const remainingMs = Math.max(0, endTime - now);
        const newRemainingSeconds = Math.floor(remainingMs / 1000);
        
        // 只有剩余时间变化时才更新，避免不必要的重绘
        if (newRemainingSeconds !== this._remainingSeconds) {
          this._remainingSeconds = newRemainingSeconds;
          this._progress = this._totalSeconds > 0 ? 
            (this._remainingSeconds / this._totalSeconds) * 100 : 100;
          hasUpdate = true;
          
          // 倒计时结束
          if (this._remainingSeconds <= 0) {
            this._timerInfo = null;
            this._timer = null;
            this._progress = 100;
            this._remainingSeconds = 0;
            this._pendingTimerRestore = false;
            
            // 2秒后同步后端状态
            this.setTimeoutSafe(() => this.refreshTimersSafe(), TimerControlCard.CONSTANTS.COUNTDOWN_END_DELAY);
          }
        }
      } else if (this._remainingSeconds > 0) {
        // 没有 end_time：使用累减方式（后备方案）
        this._remainingSeconds--;
        this._progress = this._totalSeconds > 0 ? 
          (this._remainingSeconds / this._totalSeconds) * 100 : 100;
        hasUpdate = true;
        
        // 倒计时结束
        if (this._remainingSeconds <= 0) {
          this._timerInfo = null;
          this._timer = null;
          this._progress = 100;
          this._remainingSeconds = 0;
          this._pendingTimerRestore = false;
          
          // 2秒后同步后端状态
          this.setTimeoutSafe(() => this.refreshTimersSafe(), TimerControlCard.CONSTANTS.COUNTDOWN_END_DELAY);
        }
      }
    }
    
    // 2. 【移除】不再修改任务列表中的 remaining_seconds
    // 原因：每次同步时 _activeTimersList 被完全替换，本地修改会被覆盖，导致时间跳动
    // 解决方案：在显示时实时计算剩余时间，保持任务列表数据的原始性
    
    // 3. 更新外部任务列表弹窗中的倒计时显示
    this._updateTaskListPopupCountdown();
    
    // 只要有活跃任务，就定期触发更新以刷新显示（基于 end_time 实时计算）
    if (this._activeTimersList && this._activeTimersList.length > 0) {
      // 检查是否有需要显示倒计时的任务
      const hasCountdownTask = this._activeTimersList.some(task => 
        !task.is_schedule && (task.end_time || task.remaining_seconds > 0)
      );
      if (hasCountdownTask) {
        hasUpdate = true;
      }
    }
    
    // 使用防抖更新
    if (hasUpdate) {
      this.requestUpdateDebounced();
    }
  }

  // 更新周期任务倒计时 - 【优化】直接修改避免创建新数组
  updateScheduleCountdowns() {
    let hasUpdate = false;
    
    // 直接修改 _activeTimersList 中的周期任务
    if (this._activeTimersList && this._activeTimersList.length > 0) {
      for (let i = 0; i < this._activeTimersList.length; i++) {
        const task = this._activeTimersList[i];
        if (task.is_schedule) {
          const newCountdown = this.calculateScheduleCountdown(task);
          // 只有值变化时才更新
          if (task.schedule_countdown !== newCountdown) {
            task.schedule_countdown = newCountdown;
            hasUpdate = true;
          }
        }
      }
    }
    
    // 直接修改 _activeSchedulesList
    if (this._activeSchedulesList && this._activeSchedulesList.length > 0) {
      for (let i = 0; i < this._activeSchedulesList.length; i++) {
        const schedule = this._activeSchedulesList[i];
        const newCountdown = this.calculateScheduleCountdown(schedule);
        if (schedule.schedule_countdown !== newCountdown) {
          schedule.schedule_countdown = newCountdown;
          hasUpdate = true;
        }
      }
    }
    
    if (hasUpdate) {
      this.requestUpdateDebounced();
    }
  }

  // 智能同步频率计算（使用常量）
  getSmartSyncFrequency() {
    if (!this._timerInfo) {
      return TimerControlCard.CONSTANTS.SYNC_FREQUENCIES.LOW; // 无定时器，60秒同步一次
    }
    
    const remaining = this._remainingSeconds;
    const { SYNC_FREQUENCIES, TIME_THRESHOLDS } = TimerControlCard.CONSTANTS;
    
    // 根据剩余时间动态调整同步频率
    if (remaining <= TIME_THRESHOLDS.CRITICAL) return SYNC_FREQUENCIES.CRITICAL;      // 最后1分钟：每3秒同步
    if (remaining <= TIME_THRESHOLDS.HIGH) return SYNC_FREQUENCIES.HIGH;         // 1-5分钟：每10秒同步
    if (remaining <= TIME_THRESHOLDS.MEDIUM) return SYNC_FREQUENCIES.MEDIUM;       // 5-10分钟：每20秒同步
    
    return SYNC_FREQUENCIES.LOW; // 大于10分钟：每60秒同步
  }

  // 新增：获取同步容忍阈值
  getSyncToleranceThreshold() {
    if (!this._timerInfo) {
      return TimerControlCard.CONSTANTS.TIME_THRESHOLDS.SYNC_DIFF_LOW;
    }
    
    const remaining = this._remainingSeconds;
    const { TIME_THRESHOLDS } = TimerControlCard.CONSTANTS;
    
    // 根据剩余时间动态调整容忍阈值
    if (remaining <= TIME_THRESHOLDS.CRITICAL) return TIME_THRESHOLDS.SYNC_DIFF_CRITICAL;  // 最后1分钟：容忍2秒
    if (remaining <= TIME_THRESHOLDS.HIGH) return TIME_THRESHOLDS.SYNC_DIFF_HIGH;         // 1-5分钟：容忍5秒
    if (remaining <= TIME_THRESHOLDS.MEDIUM) return TIME_THRESHOLDS.SYNC_DIFF_MEDIUM;     // 5-10分钟：容忍10秒
    
    return TIME_THRESHOLDS.SYNC_DIFF_LOW; // 大于10分钟：容忍10秒
  }

  stopCountdownLoop() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  static get styles() {
    return css`
      /* 使用 CSS Container Queries 替代媒体查询 */
      :host {
        container-type: inline-size;
        container-name: timer-card;
      }
      
      .container {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0px;
        min-height: 0px;
      }
      
      /* 容器查询：小尺寸容器 */
      @container timer-card (max-width: 480px) {
        .container {
          gap: 8px;
          padding: 0px;
        }
        
        .time-box {
          font-size: 16px !important;
          min-height: 45px !important;
          padding: 1px !important;
        }
        
        .icon-btn {
          width: 40px !important;
          height: 40px !important;
          min-width: 40px !important;
        }
        
        .category-tabs {
          padding: 2px !important;
        }
        
        .category-tab {
          min-width: 50px !important;
          padding: 4px 6px !important;
          font-size: 9px !important;
        }
        
        .quick-durations {
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 4px !important;
          margin-left: 8px !important;
        }
        
        .quick-btn {
          padding: 5px 5px !important;
        }
        
        .interval-options {
          gap: 10px !important;
          padding: 1px 5px !important;
        }
        
        .interval-option {
          min-width: 40px !important;
          max-width: 40px !important;
          width: 40px !important;
          padding: 4px 6px !important;
        }
        
        .day-btn {
          width: 20px !important;
          margin-top: 10px !important;
        }
        
        .time-inputs {
          gap: 3px !important;
          justify-content: flex-start !important;
          flex: none !important;
          width: auto !important;
        }
        
        .flip-clock-face {
          font-size: 28px !important;
        }
      }
      
      /* 容器查询：中等尺寸容器 */
      @container timer-card (min-width: 481px) and (max-width: 768px) {
        .container {
          flex-direction: row;
          gap: 10px;
          padding: 0px;
        }
        
        .time-box {
          width: 100% !important;
          min-height: 50px !important;
          font-size: 18px !important;
          padding: 1px !important;
        }
        
        .icon-btn {
          width: 44px !important;
          height: 44px !important;
          min-width: 44px !important;
        }
        
        .category-tabs {
          flex-wrap: wrap !important;
          gap: 2px !important;
        }
        
        .category-tab {
          min-width: 60px !important;
          padding: 6px 8px !important;
          font-size: 10px !important;
        }
        
        .quick-durations {
          grid-template-columns: repeat(2, 1fr) !important;
          gap: 6px !important;
          margin-left: 10px !important;
        }
        
        .button-container {
          justify-content: flex-start !important;
        }
        
        .interval-options {
          flex-direction: row !important;
          gap: 12px !important;
          justify-content: space-around !important;
        }
        
        .interval-option {
          min-width: 45px !important;
          max-width: 45px !important;
          width: 45px !important;
          padding: 6px 8px !important;
        }
      }
      
      .time-box {
        flex: 1;
        position: relative;
        padding: 5px;
        text-align: center;
        background: var(--time-box-background, #f8f9fa);
        border-radius: 5px;
        font-size: var(--time-box-font-size, 20px);
        font-weight: bold;
        cursor: pointer;
        width: var(--time-box-width, auto);
        height: var(--time-box-height, auto);
        min-width: 50px;
        min-height: var(--time-box-height, auto);
        overflow: hidden;
        border:  var(--timer-running-border, 1px solid #1976d2);
        transition: all 0.2s ease;
        /* 移除媒体查询，改用容器查询 */
      }
      
      .time-box:hover {
        background: #e9ecef;
      }
      
      .timer-running {
        background: transparent; /* 基础背景设为透明 */
        color: white;
        border: var(--timer-running-border, 1px solid #1976d2);
      }
      
      .timer-running:hover {
        /* 正在运行的定时器悬停时不变色 */
        background: transparent;
      }
      
      /* Normal 样式 - 无背景无边框 */
      .normal-container {
        position: relative;
        cursor: pointer;
        height: 100px; /* 默认高度，可被内联样式覆盖 */
        min-height: 40px;
        min-width: 40px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border-radius: 6px;
        padding: 5px;
        background: var(--timer-card-bg);
      }
      
      .normal-buttons {
        position: absolute;
        bottom: 8px;
        right: 8px;
        display: flex;
        gap: 4px;
        z-index: 10;
      }
      
      .normal-title {
        font-size: 11px;
        font-weight: 600;
        color: var(--timer-primary-text, #ffffffff);
        text-align: center;
        letter-spacing: -0.2px;
      }
      
      /* 任务滚动容器 */
      .task-scroll-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        padding: 0px 0px 0px 0px;
        overflow: hidden; /* 隐藏溢出内容，实现无缝滚动 */
        position: relative;
        margin-top: 0px;
        height: calc(100% - 30px); /* 减去标题高度，确保正确计算可用空间 */
      }
      
      /* 【优化】任务内容容器 - 使用普通CSS滚动替代3D滚动 */
      .task-scroll-content {
        position: relative;
        padding: 2px 0px 2px 0px;
        /* 使用CSS原生滚动，性能好且省电 */
        overflow-y: auto;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch; /* iOS平滑滚动 */
        /* 隐藏滚动条 - Firefox支持 */
        scrollbar-width: none;
        -ms-overflow-style: none; /* IE和Edge */
      }
      
      /* 自动滚动动画 - 当任务超出容器时 */
      @keyframes autoScroll {
        0%, 10% {
          transform: translateY(0);
        }
        45%, 55% {
          transform: translateY(-50%);
        }
        90%, 100% {
          transform: translateY(0);
        }
      }
      
      /* 有自动滚动的内容 */
      .task-scroll-content.has-auto-scroll {
        overflow-y: hidden;
      }
      
      /* 隐藏滚动条但保持滚动功能 - Webkit浏览器 */
      .task-scroll-content::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
      }
      
      /* 任务滚动容器也隐藏滚动条 */
      .task-scroll-container {
        /* 隐藏滚动条 - 全浏览器支持 */
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      
      .task-scroll-container::-webkit-scrollbar {
        display: none; /* Chrome, Safari和Opera隐藏滚动条 */
        width: 0;
        height: 0;
      }
      
      /* 滚动指示器 */
      .scroll-indicator {
        position: absolute;
        left: 15px;
        z-index: 10;
        font-size: 12px;
        color: #007aff;
        opacity: 0.7;
        transition: opacity 0.3s ease;
      }
      
      .scroll-indicator.top {
        top: 3px;
      }
      
      .scroll-indicator.bottom {
        bottom: 3px;
      }
      
      .scroll-indicator::before {
        content: "▲";
        display: block;
        font-size: 10px;
        text-align: center;
      }
      
      .scroll-indicator.bottom::before {
        content: "▼";
      }
      
      .task-item {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        margin-bottom: 2px;
        background: rgba(var(--time-box-progress-background-rgb, 0, 122, 255), 0.1);
        border-radius: 4px;
        font-size: 10px;
        color: #000000;
        animation: slideIn 0.5s ease-out;
        height: 8px; /* 固定高度，确保平滑滚动 */
        width: 95%;
        overflow: hidden;
        flex-shrink: 0; /* 防止压缩 */
        border: 1px solid rgba(var(--time-box-progress-background-rgb, 0, 122, 255), 0.2);
        transition: background 0.3s ease, border-color 0.3s ease;
      }
      
      .task-item:hover {
        background: rgba(0, 122, 255, 0.15);
        border-color: rgba(0, 122, 255, 0.4);
      }
      
      .task-progress-bar {
        position: absolute;
        top: 0;
        right: 0;
        height: 100%;
        background: rgba(var(--time-box-progress-background-rgb, 0, 122, 255), 0.1); /* 已完成部分：浅色，透明度0.1 */
        transition: width 0.5s ease;
        z-index: 1;
        border-radius: 0 4px 4px 0;
      }
      
      .task-progress-remaining {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: var(--time-box-progress-background, #1976d2); /* 未完成部分：深色，使用配置的颜色 */
        transition: width 0.5s ease;
        z-index: 1;
        border-radius: 4px 0 0 4px;
      }
      
      .task-content {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        z-index: 2;
      }
      
      .task-number {
        font-size: 9px;
        margin-left: -5px;
        font-weight: 600;
        min-width: 14px;
        color: #8e8e93; /* 统一使用灰色 */
      }
      
      .task-entity-name {
        flex: 1;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-left: -7px;
      }
      
      .task-time {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: #007aff;
        margin-left: 1px;
        min-width: 40px;
        text-align: right;
      }
      
      /* 周期任务样式 */
      .task-item.schedule-item {
        background: rgba(255, 193, 7, 0.1); /* 周期任务使用黄色背景 */
        border-left: 3px solid #ffc107; /* 左侧边框标识 */
      }
      
      .schedule-progress {
        background: linear-gradient(90deg, #ffc107 0%, #ff9800 100%) !important;
      }
      
      .schedule-number {
        color: #ff9800;
        font-weight: bold;
      }
      
      .schedule-time {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        min-width: 60px;
      }
      
      .schedule-countdown {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: #000000ff;
        font-size: 11px;
        line-height: 1;
      }
      
      .schedule-label {
        font-size: 9px;
        color: #8e8e93;
        margin-top: 2px;
        line-height: 1;
      }
      
      .schedule-info {
        font-size: 9px;
        color: #8e8e93;
        margin-top: 1px;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
      }
      
      .no-tasks-message {
        text-align: center;
        color: #8e8e93;
        font-size: 12px;
        padding: 0px;
        opacity: 0.7;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) rotateX(15deg) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) rotateX(0deg) scale(1);
        }
      }
      

      
      .timer-restoring {
        background: linear-gradient(45deg, #2196f3 25%, #64b5f6 25%, #64b5f6 50%, #2196f3 50%, #2196f3 75%, #64b5f6 75%, #64b5f6);
        background-size: 20px 20px;
        color: white;
        animation: restore-animation 1s infinite linear;
      }
      
      .time-text {
        font-variant-numeric: tabular-nums;
        position: relative;
        z-index: 2;
      }
      
      .time-text:hover {
        /* 确保悬停时不变色 */
      }
      
      .progress-bar {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        background: var(--time-box-progress-background, #1976d2); /* 未完成部分：深色 */
        transition: width 1s linear;
        z-index: 1;
      }
      
      .timer-running .progress-bar {
        background: var(--time-box-progress-background, #1976d2);
      }
      
      .restore-bar {
        background: linear-gradient(45deg, #1976d2 25%, #42a5f5 25%, #42a5f5 50%, #1976d2 50%, #1976d2 75%, #42a5f5 75%, #42a5f5);
        background-size: 20px 20px;
        animation: restore-animation 1s infinite linear;
      }
      
      .icon-btn {
        width: var(--time-box-height, 40px);
        height: var(--time-box-height, 40px);
        border: none;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          width: var(--start-btn-width, var(--time-box-height, 44px));
          height: var(--start-btn-height, var(--time-box-height, 44px));
          min-width: var(--start-btn-width, 44px);
        }
        
        @media (max-width: 480px) {
          width: var(--start-btn-width, var(--time-box-height, 40px));
          height: var(--start-btn-height, var(--time-box-height, 40px));
          min-width: var(--start-btn-width, 40px);
        }
      }
      
      .icon-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      /* 按钮容器移动端适配 */
      .button-container {
        display: flex;
        align-items: center;
        gap: 8px;
        
        @media (max-width: 768px) {
          width: 100%;
          justify-content: center;
          gap: 12px;
          justify-content: flex-start;
        }
        
        @media (max-width: 480px) {
          gap: 8px;
          justify-content: flex-start;
        }
      }
      
      .start-btn {
        background: var(--start-btn-color, #28a745);
        color: white;
        width: var(--start-btn-width, var(--time-box-height, 40px));
        height: var(--start-btn-height, var(--time-box-height, 40px));
      }
      
      .start-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--start-btn-color, #28a745) 80%, black);
      }
      
      .cancel-btn {
        background: var(--cancel-btn-color, #dc3545);
        color: white;
        width: var(--cancel-btn-width, var(--time-box-height, 40px));
        height: var(--cancel-btn-height, var(--time-box-height, 40px));
      }
      
      .cancel-btn:hover:not(:disabled) {
        background: color-mix(in srgb, var(--cancel-btn-color, #dc3545) 80%, black);
      }
      
      .popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .popup {
        background: #ffffff;
        border-radius: 14px;
        padding: 0;
        width: 90%;
        max-width: 480px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        animation: slideUp 0.4s ease;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          width: 95%;
          max-height: 85vh;
          border-radius: 12px;
        }
        
        @media (max-width: 480px) {
          width: 98%;
          max-height: 90vh;
          border-radius: 10px;
        }
      }
      
      @keyframes slideUp {
        from { 
          transform: translateY(50px); 
          opacity: 0; 
        }
        to { 
          transform: translateY(0); 
          opacity: 1; 
        }
      }
      
      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 20px 0px 20px;
        border-bottom: 1px solid #f0f0f0;
        background: #ffffff;
        border-radius: 14px 14px 0 0;
      }
      
      .popup-title {
        font-size: 13px;
        font-weight: 600;
        color: #000000;
        letter-spacing: -0.3px;
      }
      
      .popup-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #8e8e93;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
      }
      
      .popup-close:hover {
        background: #f2f2f7;
        color: #000000;
      }
      
      .section {
        padding: 20px;
        border-bottom: 1px solid #f0f0f0;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          padding: 10px 15px;
        }
      }
      
      .section:last-child {
        border-bottom: none;
      }
      
      /* 设备选择section样式 */
      .device-selection-section {
        padding: 10px 20px 0px 20px;
        border-bottom: 1px solid #f0f0f0;
        background: #ffffff;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          padding: 10px 15px;
        }
      }
      
      .device-selection-section:last-child {
        border-bottom: none;
      }
      
      .device-section-title {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 2px;
        color: #000000;
        letter-spacing: -0.2px;
      }
      
      /* 定时时长section样式 */
      .duration-section {
        padding: 10px 15px 22px 20px;
        border-bottom: 1px solid #f0f0f0;
        background: #f8f9fa;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          padding: 10px 15px;
        }
      }
      
      .duration-section:last-child {
        border-bottom: none;
      }
      
      .duration-section-title {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 2px;
        color: #000000ff;
        letter-spacing: -0.2px;
      }
      
      /* 定时动作section样式 */
      .action-section {
        padding: 5px 5px 0px 20px;
        border-bottom: 1px solid #f0f0f0;
        background: #f5f5f5;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          padding: 10px 15px;
        }
      }
      
      .action-section:last-child {
        border-bottom: none;
      }
      
      .action-section-title {
        font-size: 12px;
        font-weight: 600;
        color: #000000ff;
        letter-spacing: -0.2px;
      }
      
      .section-title {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 2px;
        color: #000000;
        letter-spacing: -0.2px;
      }
      
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .timer-mode-buttons {
        display: flex;
        gap: 8px;
        background: #f2f2f7;
        border-radius: 8px;
        padding: 4px;
      }
      
      .mode-btn {
        padding: 8px 16px;
        font-size: 11px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #8e8e93;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      
      .mode-btn:hover {
        background: rgba(0,0,0,0.05);
        color: #000000;
      }
      
      .mode-btn.active {
        background: #ffffff;
        color: #007aff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        font-weight: 600;
      }
      
      .category-tabs {
        display: flex;
        background: #f2f2f7;
        border-radius: 8px;
        padding: 4px;
        margin-bottom: 15px;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          flex-wrap: wrap;
          gap: 2px;
        }
        
        @media (max-width: 480px) {
          padding: 2px;
        }
      }
      
      .category-tab {
        flex: 1;
        padding: 8px 12px;
        text-align: center;
        cursor: pointer;
        border: none;
        background: transparent;
        font-size: 11px;
        color: #8e8e93;
        border-radius: 6px;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          min-width: 60px;
          padding: 6px 8px;
          font-size: 10px;
        }
        
        @media (max-width: 480px) {
          min-width: 50px;
          padding: 4px 6px;
          font-size: 9px;
        }
      }
      
      .category-tab:hover {
        background: rgba(0,0,0,0.05);
        color: #000000;
      }
      
      .category-tab.active {
        background: #ffffff00;
        color: #007aff;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        font-weight: 600;
      }
      
      .entity-categories-container {
        display: flex;
        gap: 15px;
        max-height: 200px;
      }
      
      .entity-categories {
        flex: 1;
        height: 200px;
        overflow-y: auto;
        padding: 0px 20px;
      }
      
      .search-sidebar {
        width: 200px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .search-input {
        width: 100%;
        padding: 10px 16px;
        border: 1px solid #c6c6c8;
        border-radius: 10px;
        font-size: 11px;
        color: #000000;
        background: #ffffff;
        transition: all 0.3s ease;
        font-weight: 400;
        letter-spacing: -0.2px;
      }
      
      .search-input:focus {
        outline: none;
        border-color: #007aff;
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      }
      
      .search-input::placeholder {
        color: #8e8e93;
        font-weight: 400;
      }
      
      .search-results {
        flex: 1;
        overflow-y: auto;
        border: 1px solid #c6c6c8;
        border-radius: 10px;
        background: #ffffff;
        padding: 0;
        margin-top: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      
      .search-results .entity-item {
        padding: 12px 16px;
        font-size: 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      
      .search-results .entity-item:last-child {
        border-bottom: none;
      }
      
      .search-results .entity-item:hover {
        background: #f2f2f7;
      }
      
      .search-results .entity-item.selected {
        background: #007aff;
        color: #ffffff;
      }
      
      .search-results .entity-name {
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 2px;
      }
      
      .search-results .entity-id {
        font-size: 14px;
        opacity: 0.7;
      }
      
      .category-group {
        margin-bottom: 15px;
      }
      
      .category-title {
        font-size: 12px;
        font-weight: 500;
        color: #000000;
        margin-bottom: 5px;
        text-transform: uppercase;
      }
      
      .entity-list {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      
      .entity-item {
        padding: 5px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        transition: all 0.2s ease;
        background: #ffffff;
        display: flex;
        flex-direction: column;
      }
      
      .entity-item:last-child {
        border-bottom: none;
      }
      
      .entity-item:hover {
        background: #f2f2f7;
      }
      
      .entity-item.selected {
        background: #007aff;
        color: #ffffff;
      }
      
      .entity-name {
        font-size: 10px;
        font-weight: 500;
        color: #000000;
        margin-bottom: 2px;
        letter-spacing: -0.2px;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          font-size: 11px;
        }
      }
      
      .entity-id {
        font-size: 10px;
        opacity: 0.7;
        color: #000000;
      }
      
      .entity-item.selected .entity-name,
      .entity-item.selected .entity-id {
        color: #ffffff;
      }
      
      .duration-inputs {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
      }
      
      .duration-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .duration-input {
        width: 40%;
        padding: 10px;
        text-align: center;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 10px;
        /* 去掉上下调节按钮 */
        -moz-appearance: textfield;
      }
      
      .duration-input::-webkit-outer-spin-button,
      .duration-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      
      .duration-input:focus {
        outline: none;
        border-color: #2196f3;
      }
      
      .duration-container {
        display: flex;
        gap: 15px;
        margin-bottom: 15px;
        padding: 0px 20px;
        height: 60px;
        
        /* 移动端适配 - 改为水平排列，翻页钟左对齐，快速时长右对齐 */
        @media (max-width: 768px) {
          flex-direction: row;
          height: auto;
          gap: 20px;
          padding: 0px 15px;
          margin-bottom: 0px;
          align-items: center;
          justify-content: space-between;
        }
        
        @media (max-width: 480px) {
          flex-direction: row;
          gap: 15px;
          padding: 0px 10px;
          margin-bottom: 0px;
          align-items: center;
          justify-content: space-between;
        }
      }
      
      .time-inputs {
        flex: 1;
        display: flex;
        gap: 1px;
        align-items: center;
        margin-left: 20px;
        margin-top: 30px;
        
        /* 移动端适配 - 左对齐 */
        @media (max-width: 768px) {
          margin-left: 0;
          margin-top: 0px;
          justify-content: flex-start;
          gap: 5px;
          flex: none;
          width: auto;
        }
        
        @media (max-width: 480px) {
          gap: 3px;
          justify-content: flex-start;
          flex: none;
          width: auto;
        }
      }
      
      /* 周期定时模式下的翻页钟样式 */
      .interval-options ~ .time-inputs {
        margin-top: 0px;
      }
      
      .colon-separator {
        font-size: 16px;
        font-weight: bold;
        color: #000000;
        margin: 0 5px;
      }
      
      /* 翻页钟样式 */
      .flip-clock-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0px;
      }
      
      .flip-clock-input {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        position: relative;
        width: 40px;
        height: 60px;
        perspective: 200px;
        cursor: default;
      }
      
      .flip-clock-top,
      .flip-clock-bottom {
        position: absolute;
        left: 0;
        right: 0;
        height: 30px;
        cursor: pointer;
        z-index: 2;
      }
      
      .flip-clock-top {
        top: 0;
        border-radius: 4px 4px 0 0;
      }
      
      .flip-clock-bottom {
        bottom: 0;
        border-radius: 0 0 4px 4px;
      }
      
      .flip-clock-top:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .flip-clock-bottom:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .flip-clock-card {
        position: relative;
        width: 110%;
        height: 100%;
        transform-style: preserve-3d;
        transition: transform 0.3s ease;
      }
      
      .flip-clock-face {
        position: absolute;
        width: 100%;
        height: 100%;
        backface-visibility: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: bold;
        color: #ffffff;
        background: #000000;
        border: 1px solid #333333;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transform: scaleX(1.5) scaleY(0.8); /* 拉长宽度1.5倍，压扁高度为0.8倍 */
      }
      
      .flip-clock-face.front {
        transform: rotateX(0deg);
      }
      
      .flip-clock-face.back {
        transform: rotateX(180deg);
      }
      
      .flip-clock-card.flipping .front {
        transform: rotateX(-180deg);
      }
      
      .flip-clock-card.flipping .back {
        transform: rotateX(0deg);
      }
      
      .flip-clock-input:hover {
        cursor: pointer;
      }
      
      .flip-clock-input:hover .flip-clock-face {
        /* 移除背景色变化，保持黑色背景不变 */
      }
      
      /* 翻页钟分割线效果 */
      .flip-clock-input::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background: #666666;
        z-index: 1;
      }
      
      /* 翻页钟阴影效果 */
      .flip-clock-card {
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      
      .flip-clock-card.flipping {
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      
      .quick-durations {
        width: 266px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        
        /* 移动端适配 - 显示在翻页钟右侧 */
        @media (max-width: 768px) {
          width: auto;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
          flex: 1;
          margin-left: 10px;
        }
        
        @media (max-width: 480px) {
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          width: auto;
          flex: 1;
          margin-left: 8px;
        }
      }
      
      .quick-btn {
        padding: 12px 8px;
        background: #f2f2f7;
        border: 1px solid transparent;
        border-radius: 10px;
        cursor: pointer;
        font-size: 11px;
        color: #000000;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;

        @media (max-width: 480px) {
          padding: 5px 5px;
          gap: 6px;
        }


      }
      
      .quick-btn:hover {
        background: #e5e5ea;
        transform: translateY(-1px);
      }
      
      .action-options {
        display: flex;
        flex-direction: row;
        gap: 20px;
        justify-content: space-between;
        align-items: center;
        padding: 0;
        
        /* 移动端适配 - 保持水平排列 */
        @media (max-width: 768px) {
          flex-direction: row;
          gap: 12px;
          justify-content: space-around;
          flex-wrap: wrap;
        }
        
        @media (max-width: 480px) {
          gap: 8px;
          justify-content: space-between;
        }
      }
      
      .action-option {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        padding: 12px 16px;
        border-radius: 10px;
        transition: all 0.3s ease;
        background: #f2f2f7;
        flex: 1;
        border: 2px solid transparent;
      }
      
      .action-option:hover {
        background: #e5e5ea;
        transform: translateY(-1px);
      }
      
      .action-option input[type="radio"]:checked + .action-label {
        color: #007aff;
      }
      
      .action-option input[type="radio"] {
        accent-color: #007aff;
        width: 18px;
        height: 18px;
      }
      
      .action-label {
        font-size: 11px;
        color: #000000;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      
      /* 空调动作样式 */
      .climate-action-container {
        display: flex;
        flex-direction: row;
        gap: 2px;
        padding: 2px 0;
        
        @media (max-width: 768px) {
          flex-direction: column;
          gap: 15px;
        }
      }
      
      .climate-modes-section {
        flex: 6;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .climate-modes-title {
        font-size: 11px;
        font-weight: 500;
        color: #8e8e93;
        letter-spacing: -0.2px;
      }
      
      .climate-modes {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-start;
      }
      
      .climate-mode-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 35px;
        height: 35px;
        border: 2px solid #e5e5ea;
        border-radius: 10px;
        background: #ffffff;
        cursor: pointer;
        transition: all 0.3s ease;
        padding: 0;
        
        @media (max-width: 480px) {
          width: 45px;
          height: 45px;
        }
      }
      
      .climate-mode-btn:hover {
        background: #f2f2f7;
        border-color: #007aff;
      }
      
      .climate-mode-btn.active {
        border-color: #007aff;
        background: #e3f2fd;
        color: #007aff;
      }
      
      .climate-mode-btn ha-icon {
        font-size: 23px;
        color: #8e8e93;
        
        @media (max-width: 480px) {
          font-size: 20px;
        }
      }
      
      .climate-mode-btn.active ha-icon {
        color: #007aff;
      }
      
      .climate-temperature-section {
        flex: 4;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .climate-temperature-title {
        font-size: 11px;
        font-weight: 500;
        color: #8e8e93;
        letter-spacing: -0.2px;
      }
      
      .temperature-slider-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 5px 0;
        position: relative;
      }
      
      .slider-wrapper {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        overflow: visible;
        width: 100%;
      }
      
      .temperature-labels-container {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-top: 2px;
      }
      
      .temperature-label {
        font-size: 12px;
        font-weight: 500;
        color: #8e8e93;
        min-width: 30px;
        text-align: center;
      }
      
      .temperature-label.min-label {
        text-align: left;
      }
      
      .temperature-label.max-label {
        text-align: right;
      }
      
      .temperature-slider {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: #e5e5ea;
        appearance: none;
        outline: none;
        -webkit-appearance: none;
        position: relative;
        z-index: 1;
      }
      
      .temperature-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 40px;
        height: 24px;
        border-radius: 6px;
        background: #007aff;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 122, 255, 0.3);
        transition: transform 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .temperature-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }
      
      .temperature-slider::-moz-range-thumb {
        width: 40px;
        height: 24px;
        border-radius: 6px;
        background: #007aff;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 4px rgba(0, 122, 255, 0.3);
        transition: transform 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .temperature-slider::-moz-range-thumb:hover {
        transform: scale(1.1);
      }
      
      .temperature-display {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 11px;
        font-weight: 600;
        color: #ffffff;
        padding: 3px 8px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        max-width: 50px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
        
        @media (max-width: 480px) {
          font-size: 10px;
          padding: 2px 6px;
          max-width: 45px;
        }
      }

      /* 窗帘动作样式 */
      .cover-action-container {
        display: flex;
        flex-direction: row;
        gap: 2px;
        padding: 2px 0;

        @media (max-width: 768px) {
          flex-direction: column;
          gap: 15px;
        }
      }

      .cover-actions-section {
        flex: 6;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .cover-actions-title {
        font-size: 11px;
        font-weight: 500;
        color: #8e8e93;
        letter-spacing: -0.2px;
        margin-bottom: 10px;
      }

      .cover-actions {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-start;
      }

      .cover-action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 35px;
        height: 35px;
        border: 2px solid #e5e5ea;
        border-radius: 10px;
        background: #ffffff;
        cursor: pointer;
        transition: all 0.3s ease;
        padding: 0;

        @media (max-width: 480px) {
          width: 45px;
          height: 45px;
        }
      }

      .cover-action-btn:hover {
        background: #f2f2f7;
        border-color: #007aff;
      }

      .cover-action-btn.active {
        border-color: #007aff;
        background: #e3f2fd;
        color: #007aff;
      }

      .cover-action-btn ha-icon {
        font-size: 23px;
        color: #8e8e93;

        @media (max-width: 480px) {
          font-size: 20px;
        }
      }

      .cover-action-btn.active ha-icon {
        color: #007aff;
      }

      .cover-position-section {
        flex: 4;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .cover-position-title {
        font-size: 11px;
        font-weight: 500;
        color: #8e8e93;
        letter-spacing: -0.2px;
      }

      .position-slider-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 5px 0;
        position: relative;
      }

      .slider-wrapper {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        overflow: visible;
        width: 100%;
      }

      .position-labels-container {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-top: 2px;
      }

      .position-label {
        font-size: 12px;
        font-weight: 500;
        color: #8e8e93;
        min-width: 30px;
        text-align: center;
      }

      .position-label.min-label {
        text-align: left;
      }

      .position-label.max-label {
        text-align: right;
      }

      .position-slider {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: #e5e5ea;
        appearance: none;
        outline: none;
        -webkit-appearance: none;
        position: relative;
        z-index: 1;
      }

      .position-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 40px;
        height: 24px;
        border-radius: 6px;
        background: #2196f3;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
        transition: transform 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .position-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }

      .position-slider::-moz-range-thumb {
        width: 40px;
        height: 24px;
        border-radius: 6px;
        background: #2196f3;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
        transition: transform 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .position-slider::-moz-range-thumb:hover {
        transform: scale(1.1);
      }

      .position-display {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 11px;
        font-weight: 600;
        color: #ffffff;
        padding: 3px 8px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        max-width: 50px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;

        @media (max-width: 480px) {
          font-size: 10px;
          padding: 2px 6px;
          max-width: 45px;
        }
      }

      /* 周期定时样式 */
      .interval-options {
        display: flex;
        flex-direction: row;
        gap: 15px;
        justify-content: center;
        align-items: center;
        padding: 0 20px;
        margin-bottom: 0px;
        position: relative; /* 为下拉框定位提供相对参考 */
        overflow: visible; /* 确保下拉框可见 */

        @media (max-width: 480px) {
          gap: 10px;
          padding: 1px 5px;
          margin-top: -17px;

        }
      }
      
      /* 周期选项容器样式 */
      .recurring-options {
        position: relative; /* 确保相对定位 */
        overflow: visible; /* 确保下拉框可见 */
      }
      
      .interval-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        transition: all 0.3s ease;
        background: #f2f2f7;
        flex: none;
        border: 1px solid transparent;
        width: 25px;
        position: relative;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          min-width: 45px;
          max-width: 45px;
          width: 45px;
          padding: 6px 8px;
        }
        
        @media (max-width: 480px) {
          min-width: 40px;
          max-width: 40px;
          width: 40px;
          padding: 4px 6px;
        }
      }
      
      .interval-option:hover {
        background: #e5e5ea;
        transform: translateY(-1px);
      }
      
      .interval-option input[type="radio"]:checked + .interval-label {
        color: #007aff;
        font-weight: 600;
      }
      
      .interval-option input[type="radio"] {
        accent-color: #007aff;
        width: 16px;
        height: 16px;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          width: 14px;
          height: 14px;
        }
        
        @media (max-width: 480px) {
          width: 12px;
          height: 12px;
        }
      }
      
      .interval-label {
        font-size: 11px;
        color: #000000;
        font-weight: 500;
        letter-spacing: -0.2px;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          font-size: 10px;
        }
        
        @media (max-width: 480px) {
          font-size: 9px;
        }
      }
      
      .days-selection {
        padding: 0 20px;
        margin-bottom: 15px;

        @media (max-width: 480px) {
          margin-bottom: 0px;

        }
      }
      

      
      .days-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 5px;
        margin-top: 3px;
        height: 30px;
      }
      
      .day-btn {
        padding: 8px 0;
        border: 1px solid #c6c6c8;
        border-radius: 6px;
        cursor: pointer;
        font-size: 10px;
        color: #000000;
        background: #ffffff;
        transition: all 0.3s ease;
        font-weight: 500;
        text-align: center;

        @media (max-width: 768px) {
          width: 20px;
          margin-top: 10px;
        }
      }
      
      .day-btn:hover {
        background: #f2f2f7;
        transform: translateY(-1px);
      }
      
      .day-btn.selected {
        background: #007aff;
        color: #ffffff;
        border-color: #007aff;
      }
      
      /* 每月日期网格选择器样式 */
      .monthly-grid-dropdown {
        display: grid;
        grid-template-columns: repeat(11, 1fr);
        grid-template-rows: repeat(3, auto);
        gap: 4px;
        padding: 4px 4px;
        background: #ffffff;
        border-radius: 8px;
        border: 1px solid #c6c6c8;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideDown 0.2s ease;
        position: absolute;
        top: 110%;
        left: -197px;
        margin-top: 8px;
        z-index: 2;
        min-width: 395px;
        width: 100%;
        visibility: visible;
        opacity: 1;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          grid-template-columns: repeat(11, 1fr);
          gap: 3px;
          padding: 6px 15px;
          top: 110%;
          left: -15px;
          margin-top: 8px;
          z-index: 2;
          min-width: 355px;
        }
        
        @media (max-width: 480px) {
          grid-template-columns: repeat(11, 1fr);
          gap: 2px;
          padding: 4px 10px;
          top: 110%;
          left: -190px;
          margin-top: 8px;
          z-index: 2;
          min-width: 355px;
        }
      }
      
      @keyframes slideDown {
        from { 
          opacity: 0; 
          transform: translateY(-10px); 
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
      
      .monthly-day-btn {
        padding: 8px 4px;
        border: 1px solid #c6c6c8;
        border-radius: 6px;
        background: #ffffff;
        color: #000000;
        font-size: 9px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 31px;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          padding: 6px 2px;
          font-size: 9px;
          min-height: 24px;
          width: 25px;
          height: 25px;
        }
        
        @media (max-width: 480px) {
          padding: 4px 1px;
          font-size: 8px;
          min-height: 20px;
          width: 25px;
          height: 25px;
        }
      }
      
      .monthly-day-btn:hover {
        background: #f2f2f7;
        border-color: #007aff;
        transform: translateY(-1px);
      }
      
      .monthly-day-btn.selected {
        background: #007aff;
        color: #ffffff;
        border-color: #007aff;
        font-weight: 600;
        transform: scale(1.05);
      }
      
      .monthly-day-btn.selected:hover {
        background: #0056d6;
        border-color: #0056d6;
      }
      
      /* 每月下拉框关闭按钮样式 */
      .monthly-close-btn {
        background: #ff3b30 !important;
        color: #ffffff !important;
        border-color: #ff3b30 !important;
        font-weight: bold;
        font-size: 14px !important;
      }
      
      .monthly-close-btn:hover {
        background: #d70015 !important;
        border-color: #d70015 !important;
        transform: scale(1.1);
      }
      
      /* 每月下拉框确认按钮样式 */
      .monthly-confirm-btn {
        background: #34c759 !important;
        color: #ffffff !important;
        border-color: #34c759 !important;
        font-weight: bold;
        font-size: 14px !important;
      }
      
      .monthly-confirm-btn:hover {
        background: #30a14e !important;
        border-color: #30a14e !important;
        transform: scale(1.1);
      }
      
      .popup-footer {
        display: flex;
        gap: 60px;
        padding: 10px 80px;
        background: #f8f8fa;
        border-radius: 0 0 14px 14px;
        border-top: 1px solid #f0f0f0;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          padding: 5px 80px;
        }
      }
      
      .popup-btn {
        flex: 1;
        padding: 16px;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.3s ease;
        letter-spacing: -0.3px;
        display: flex;
        align-items: center;
        justify-content: center;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          height: 35px;
          padding: 0;
        }
      }
      
      .popup-btn:first-child {
        background: #ffffff;
        color: #007aff;
        border: 1px solid #c6c6c8;
      }
      
      .popup-btn:first-child:hover {
        background: #f2f2f7;
        transform: translateY(-1px);
      }
      
      .save-btn {
        background: #007aff;
        color: white;
        border: 1px solid #007aff;
      }
      
      .save-btn:hover {
        background: #0056d6;
        transform: translateY(-1px);
      }
      
      /* 任务列表弹窗样式 */
      .task-list-popup {
        background: #ffffff;
        border-radius: 14px;
        width: 90%;
        max-width: 500px;
        max-height: 70vh;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        animation: slideUp 0.4s ease;
      }
      
      .task-list-popup.has-tasks {
        background: #fffacd;
        color: #ffffff;
      }
      
      .task-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px 5px 10px;
        border-bottom: 1px solid #f0f0f0;
        background: #ffffff;
        border-radius: 14px 14px 0 0;
      }
      
      .task-list-title {
        font-size: 13px;
        font-weight: 600;
        color: #000000;
        letter-spacing: -0.3px;
      }
      
      .task-list-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #8e8e93;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
      }
      
      .task-list-close:hover {
        background: #f2f2f7;
        color: #000000;
      }
      
      .task-list-content {
        padding: 0;
        max-height: 400px;
        overflow-y: auto;
      }
      
      .task-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 16px;
        color: #000000;
      }
      
      .task-table thead {
        background: #f8f8fa;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      
      .task-table th {
        padding: 4px 4px;
        text-align: left;
        font-weight: 600;
        font-size: 12px;
        color: #000000;
        border-bottom: 1px solid #f0f0f0;
        letter-spacing: -0.2px;
      }
      
      .task-table tbody tr {
        border-bottom: 1px solid #f0f0f0;
        transition: background-color 0.2s ease;
      }
      
      .task-table tbody tr:hover {
        background: #f2f2f7;
      }
      
      .task-table tbody tr:last-child {
        border-bottom: none;
      }
      
      .task-table td {
        padding: 16px 20px;
        vertical-align: middle;
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          padding: 5px 0px;
        }
      }
      
      .task-table .entity-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .task-table .entity-name {
        font-size: 12px;
        font-weight: 500;
        color: #000000;
        letter-spacing: -0.2px;
      }
      
      .task-table .entity-id {
        font-size: 10px;
        color: #8e8e93;
        font-weight: 400;
      }
      
      .task-table .time-display {
        font-size: 16px;
        font-weight: 600;
        color: #007aff;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.2px;
      }
      
      .task-actions {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      
      .task-cancel-btn {
        padding: 4px 12px;
        font-size: 11px;
        background: #ff3b30;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        min-width: 60px;
      }
      
      .task-cancel-btn:hover {
        background: #d70015;
        transform: translateY(-1px);
      }
      
      .task-modify-btn {
        padding: 4px 12px;
        font-size: 11px;
        background: #007aff;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        min-width: 60px;
      }
      
      .task-modify-btn:hover {
        background: #0056d6;
        transform: translateY(-1px);
      }
      
      .task-cancel-all-btn {
        padding: 4px 12px;
        font-size: 11px;
        background: #ff9500;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        min-width: 60px;
      }
      
      .task-cancel-all-btn:hover {
        background: #e68500;
        transform: translateY(-1px);
      }
      
      .empty-state {
        padding: 60px 20px;
        text-align: center;
        color: #8e8e93;
      }
      
      /* 图标大小统一定义 */
      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
        width: 48px;
        height: 48px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      
      /* 任务滚动内容中的暂无任务文字 */
      .task-scroll-content .no-tasks-message {
        font-size: 12px;
        color: #8e8e93;
        text-align: center;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }
      
      /* 确保任务滚动内容容器支持绝对定位 */
      .task-scroll-content {
        position: relative;
        min-height: 100%;
      }
      
      /* SVG图标统一大小 */
      .icon-btn svg {
        width: 20px;
        height: 20px;
        min-width: 20px;
        min-height: 20px;
      }
      
      /* 弹窗按钮图标大小 */
      .popup-btn svg {
        width: 18px;
        height: 18px;
        min-width: 18px;
        min-height: 18px;
      }
      
      /* 任务操作按钮图标大小 */
      .task-actions svg {
        width: 16px;
        height: 16px;
        min-width: 16px;
        min-height: 16px;
      }
      
      .empty-state-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #000000;
        letter-spacing: -0.2px;
      }
      
      .empty-state-subtitle {
        font-size: 15px;
        color: #8e8e93;
        font-weight: 400;
      }
      
      .connection-indicator {
        position: absolute;
        top: 3px;
        right: 4px;
        width: var(--status-indicator-width, 6px);
        height: var(--status-indicator-height, 6px);
        border-radius: 50%;
        z-index: 1;
      }
      
      .connection-indicator.connected {
        background-color: var(--status-indicator-color, #28a745);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--status-indicator-color, #28a745) 30%, transparent);
        animation: pulse 2s infinite;
      }
      
      .connection-indicator.disconnected {
        background-color: #dc3545;
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.3);
      }
      
      .task-count {
        position: absolute;
        top: 1px;
        left: 2px;
        font-size: 8px;
        font-weight: bold;
        color: #ffffff;
        background:  #ee5a52;
        padding: 0px 3px;
        border-radius: 8px;
        min-width: 6px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        z-index: 1;
      }
      
      .sync-error {
        position: absolute;
        top: 4px;
        left: 4px;
        font-size: 8px;
        color: #dc3545;
        background: rgba(220, 53, 69, 0.1);
        padding: 1px 3px;
        border-radius: 2px;
      }
      
      .sync-status {
        font-size: 8px;
        color: #6c757d;
        position: absolute;
        top: 1px;
        left: 4px;
      }
      
      .debug-info {
        position: absolute;
        bottom: 4px;
        left: 4px;
        right: 4px;
        font-size: 9px;
        color: var(--timer-primary-text, #ff9800);
        background: var(--timer-popup-bg, rgba(0, 0, 0, 0.7));
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        z-index: 10;
        opacity: 0.9;
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      @keyframes restore-animation {
        0% { background-position: 0 0; }
        100% { background-position: 20px 20px; }
      }
      
      /* 下拉选择器模式样式 */
      .pull-down-mode {
        cursor: default !important;
        background: var(--time-box-background, #f8f9fa) !important;
        border: var(--timer-running-border, 1px solid #1976d2);
      }
      
      .time-selectors {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        position: relative;
        z-index: 2;
        padding: 5px 10px;
      }
      
      .time-select {
        width: 45px;
        font-size: var(--time-box-font-size, 18px);
        font-weight: 600;
        color: #000000;
        background: transparent;
        border: 1px solid rgba(0,0,0,0.2);
        border-radius: 3px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
        font-variant-numeric: tabular-nums;
        font-family: inherit;
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        padding: 0px 5px;
      }
      
      .time-select:hover {
        background: rgba(0,0,0,0.05);
        border-color: rgba(0,0,0,0.3);
      }
      
      .time-select:focus {
        outline: none;
        background: rgba(0,0,0,0.08);
        border-color: #007aff;
      }
      
      .time-separator {
        font-size: var(--time-box-font-size, 18px);
        font-weight: 600;
        color: #000000;
        opacity: 0.6;
      }
    `;
  }

  render() {
    const hasTimer = !!this._timerInfo;
    
    // 检查配置的实体是否有周期任务
    const hasSchedule = this._activeTimersList.some(task => 
      task.is_schedule && task.entity_id === this.config.entity
    );
    
    // 计算显示时间：如果有定时器显示倒计时，如果有周期任务显示周期倒计时，否则显示配置的default_duration值
    let displayTime;
    if (hasTimer) {
      displayTime = this.formatTime(this._remainingSeconds);
    } else if (hasSchedule) {
      // 找到该实体的周期任务并显示倒计时
      const scheduleTask = this._activeTimersList.find(task => 
        task.is_schedule && task.entity_id === this.config.entity
      );
      displayTime = this.formatTaskTime(scheduleTask?.schedule_countdown || 0);
    } else {
      displayTime = this.config.default_duration || "00:30:00";
    }
    
    const isConnected = this._lastSyncSuccessTime && (Date.now() - this._lastSyncSuccessTime < 120000);
    const showSyncError = this._lastSyncFailed && !isConnected;
    const showConnectionStatus = !isConnected;

    // 根据卡片样式渲染不同的界面
    if (this.config.card_style === 'normal') {
      return this.renderNormalStyle(hasTimer, displayTime, isConnected, showSyncError, showConnectionStatus);
    } else {
      return this.renderMiniStyle(hasTimer, displayTime, isConnected, showSyncError, showConnectionStatus);
    }
  }

  renderMiniStyle(hasTimer, displayTime, isConnected, showSyncError, showConnectionStatus) {
    // 检查配置的实体是否有周期任务
    const hasSchedule = this._activeTimersList.some(task => 
      task.is_schedule && task.entity_id === this.config.entity
    );
    
    // 检查是否使用 pull-down 模式：没有定时器且没有周期任务时才使用
    const usePullDownMode = this.config.card_style === 'mini' && 
                           this.config.second_style === 'pull-down' && 
                           !hasTimer && !hasSchedule;
    
    // 转换进度条背景色为RGB格式
    const progressRgb = this.hexToRgb(this.config.time_box_progress_background || '#1976d2');
    const progressRgbValue = progressRgb ? `${progressRgb.r}, ${progressRgb.g}, ${progressRgb.b}` : '0, 122, 255';
    
    return html`
      <div class="container" style="
        --time-box-font-size: ${this.config.time_box_font_size};
        --time-box-width: ${this.config.time_box_width};
        --time-box-height: ${this.config.time_box_height};
        --time-box-background: ${this.config.time_box_background};
        --time-box-progress-background: ${this.config.time_box_progress_background};
        --time-box-progress-background-rgb: ${progressRgbValue};
        --timer-running-border: ${this.config.timer_running_border};
        --status-indicator-color: ${this.config.status_indicator_color};
        --status-indicator-width: ${this.config.status_indicator_width};
        --status-indicator-height: ${this.config.status_indicator_height};
        --start-btn-color: ${this.config.start_btn_color};
        --start-btn-width: ${this.config.start_btn_width};
        --start-btn-height: ${this.config.start_btn_height};
        --cancel-btn-color: ${this.config.cancel_btn_color};
        --cancel-btn-width: ${this.config.cancel_btn_width};
        --cancel-btn-height: ${this.config.cancel_btn_height};
      ">
        <!-- 主界面：显示当前实体的定时倒计时 -->
        <div class="main-content">
          <div class="time-box ${hasTimer ? 'timer-running' : ''} ${usePullDownMode ? 'pull-down-mode' : ''}" @click=${this.toggleTaskList}>
            <!-- 进度条（未完成部分-深色，从左侧开始） -->
            ${hasTimer ? html`<div class="progress-bar" style="width: ${this._progress}%;"></div>` : ''}
            
            ${usePullDownMode ? html`
              <!-- 下拉选择器模式 -->
              <div class="time-selectors">
                <select
                  class="time-select"
                  value="${this._selectedHours}"
                  @change=${e => this.handleTimeChange('hours', e.target.value)}
                >
                  ${Array.from({length: 24}, (_, i) =>
                    html`<option value="${i}" ?selected=${this._selectedHours === i}>${String(i).padStart(2, '0')}</option>`
                  )}
                </select>
                <span class="time-separator">:</span>
                <select
                  class="time-select"
                  value="${this._selectedMinutes}"
                  @change=${e => this.handleTimeChange('minutes', e.target.value)}
                >
                  ${Array.from({length: 60}, (_, i) =>
                    html`<option value="${i}" ?selected=${this._selectedMinutes === i}>${String(i).padStart(2, '0')}</option>`
                  )}
                </select>
              </div>
            ` : html`
              <!-- 时间显示 -->
              <div class="time-text" style="color: ${this.getTextColorBasedOnBackground(hasTimer ? '#2196f3' : (this.config.time_box_background || '#f8f9fa'))};">${displayTime}</div>
            `}
            
            <!-- 状态指示器 -->
            <div class="connection-indicator ${showConnectionStatus ? 'disconnected' : 'connected'}"></div>
            
            <!-- 任务个数显示 -->
            ${isConnected && this._activeTimersCount > 0 ? html`
              <div class="task-count">${this._activeTimersCount}</div>
            ` : ''}
            
            <!-- 错误信息 -->
            ${showSyncError ? html`
              <div class="sync-error">同步失败</div>
            ` : ''}
            
            <!-- 同步状态 - 只在同步失败时显示 -->
            ${showSyncError ? html`
              <div class="sync-status">同步失败</div>
            ` : ''}
            
            <!-- 调试信息 -->
            ${this.config.show_debug && this._debugInfo ? html`
              <div class="debug-info">${this._debugInfo}</div>
            ` : ''}
          </div>
        </div>
        
        <!-- 控制按钮区域 -->
        ${this.config.show_buttons ? html`
          <div class="button-container" style="display: flex; align-items: center; gap: 8px;">
            <!-- 开始/取消按钮 -->
            ${hasTimer ? html`
              <button 
                class="icon-btn cancel-btn" 
                @click=${this.cancelTimer}
                ?disabled=${!this._hassReady} 
                title="取消定时器"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h12v12H6z"/>
                </svg>
              </button>
            ` : html`
              <button 
                class="icon-btn start-btn" 
                @click=${usePullDownMode ? this.confirmTimePicker : this.startTimer}
                ?disabled=${!this._hassReady} 
                title="开始定时器"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            `}
          </div>
        ` : ''}
        
        <!-- 调试信息 -->
        ${this.config.show_debug && this._debugInfo ? html`
          <div class="debug-info">${this._debugInfo}</div>
        ` : ''}
      </div>
    `;
  }

  renderNormalStyle(hasTimer, displayTime, isConnected, showSyncError, showConnectionStatus) {
    // 计算容器高度
    const heightValue = parseInt(this.config.normal_height) || 100;
    const taskHeight = 16; // 单条任务条高度：16px
    const titleHeight = 18; // 标题高度：18px
    const availableHeight = heightValue - titleHeight;
    

    // 转换进度条背景色为RGB格式
    const progressRgb = this.hexToRgb(this.config.time_box_progress_background || '#1976d2');
    const progressRgbValue = progressRgb ? `${progressRgb.r}, ${progressRgb.g}, ${progressRgb.b}` : '0, 122, 255';
    
    // 【优化】简化滚动逻辑，使用普通CSS滚动替代3D滚动
    const visibleTasks = this._activeTimersList || [];
    
    // 计算实际需要的滚动容器高度（包含padding和margin）
    const contentHeight = visibleTasks.length * (taskHeight + 2); // +2 for margin-bottom
    const needsScroll = contentHeight > availableHeight;
    // 只有当需要滚动时才限制高度，否则让容器自适应内容
    const taskContainerStyle = needsScroll 
      ? `height: ${availableHeight}px; overflow-y: hidden;` // 自动滚动时隐藏滚动条
      : 'height: auto; overflow-y: hidden;';
    // 需要滚动时添加CSS动画类
    const scrollContentClass = needsScroll 
      ? 'task-scroll-content has-auto-scroll' 
      : 'task-scroll-content';
    const scrollContentStyle = needsScroll
      ? `position: relative; animation: autoScroll ${visibleTasks.length * 3}s linear infinite;`
      : 'position: relative;';
    
    return html`
      <div 
        class="normal-container" 
        @click=${this.toggleTaskList} 
        style="
          height: ${this.config.normal_height};
          ${this.config.normal_background ? `background: ${this.config.normal_background};` : ''}
          --time-box-progress-background: ${this.config.time_box_progress_background};
          --time-box-progress-background-rgb: ${progressRgbValue};
        "
      >
        <!-- 标题 -->
        <div class="normal-title">任务中心</div>
        
        <!-- 状态指示器 -->
        <div class="connection-indicator ${showConnectionStatus ? 'disconnected' : 'connected'}" style="
          width: ${this.config.status_indicator_width || '6px'}; 
          height: ${this.config.status_indicator_height || '6px'};
        "></div>
        
        <!-- 任务个数显示 -->
        ${isConnected && this._activeTimersCount > 0 ? html`
          <div class="task-count">${this._activeTimersCount}</div>
        ` : ''}
        
        <!-- 错误信息 -->
        ${showSyncError ? html`
          <div class="sync-error">同步失败</div>
        ` : ''}
        
        <!-- 任务倒计时显示 -->
        <div class="task-scroll-container" style="position: relative; overflow: hidden;">
          <!-- 任务列表容器 -->
          <div style="${taskContainerStyle}">
            <!-- 任务内容 -->
            <div 
              class="${scrollContentClass}" 
              style="${scrollContentStyle}"
            >
              ${visibleTasks.map((task, index) => {
                // 检查是否为周期任务
                const isSchedule = task.is_schedule;
                
                if (isSchedule) {
                  // 周期任务显示
                  const countdownSeconds = task.schedule_countdown || 0;
                  
                  return html`
                    <div 
                      class="task-item schedule-item" 
                      data-entity-id="${task.entity_id}"
                    >
                      <!-- 周期任务进度条（使用不同的颜色） -->
                      <div class="task-progress-bar schedule-progress" style="width: 100%;"></div>
                      <div class="task-content">
                        <div class="task-number schedule-number">${index + 1}</div>
                        <div class="task-entity-name">${this.getEntityFriendlyName(task.entity_id)}</div>
                        <div class="task-time schedule-time">
                          <div class="schedule-countdown">${this.formatTaskTime(countdownSeconds)}${this.getTaskActionDisplayText(task)}</div>
                        </div>
                      </div>
                    </div>
                  `;
                } else {
                  // 普通定时器显示
                  const totalSeconds = task.duration ? this.durationToSeconds(task.duration) : 1800;
                  const remainingSeconds = this.getTaskRemainingSeconds(task);
                  const progressPercent = totalSeconds > 0 ? (1 - remainingSeconds / totalSeconds) * 100 : 0;
                  const remainingPercent = 100 - progressPercent;
                  
                  return html`
                    <div 
                      class="task-item" 
                      data-entity-id="${task.entity_id}"
                    >
                      <!-- 进度条背景 -->
                      <div class="task-progress-bar" style="width: ${progressPercent}%;"></div>
                      <div class="task-progress-remaining" style="width: ${remainingPercent}%;"></div>
                      <div class="task-content">
                        <div class="task-number">${index + 1}</div>
                        <div class="task-entity-name">${this.getEntityFriendlyName(task.entity_id)}</div>
                        <div class="task-time">${this.formatTaskTime(remainingSeconds)}${this.getTaskActionDisplayText(task)}</div>
                      </div>
                    </div>
                  `;
                }
              })}
            </div>
          </div>
          
          ${this._activeTimersList.length === 0 ? html`
            <!-- 没有任务时显示 -->
            <div class="no-tasks-message" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">暂无任务</div>
          ` : ''}
        </div>
        
        <!-- 时间选择器弹窗 (pull-down 模式) -->
        ${this._showTimePicker ? this.renderTimePicker() : ''}
        
        <!-- 控制按钮区域 -->
        ${this.config.show_buttons ? html`
          <div class="normal-buttons">
            <!-- 开始/取消按钮 -->
            ${hasTimer ? html`
              <button 
                class="icon-btn cancel-btn" 
                @click=${this.cancelTimer}
                ?disabled=${!this._hassReady} 
                title="取消定时器"
                style="
                  width: ${this.config.cancel_btn_width || '32px'}; 
                  height: ${this.config.cancel_btn_height || '32px'};
                  background: ${this.config.cancel_btn_color || '#dc3545'};
                "
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h12v12H6z"/>
                </svg>
              </button>
            ` : html`
              <button 
                class="icon-btn start-btn" 
                @click=${this.startTimer}
                ?disabled=${!this._hassReady} 
                title="开始定时器"
                style="
                  width: ${this.config.start_btn_width || '32px'}; 
                  height: ${this.config.start_btn_height || '32px'};
                  background: ${this.config.start_btn_color || '#28a745'};
                "
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            `}
          </div>
        ` : ''}
        
        <!-- 调试信息 -->
        ${this.config.show_debug && this._debugInfo ? html`
          <div class="debug-info">${this._debugInfo}</div>
        ` : ''}
      </div>
    `;
  }



  // 格式化任务时间显示
  formatTaskTime(seconds) {
    if (!seconds) return '00:00:00';
    
    // 确保只处理整数秒数，去掉小数部分
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // 计算周期任务的倒计时
  calculateScheduleCountdown(schedule) {
    if (!schedule.next_execution) return null;
    
    try {
      const nextExecution = new Date(schedule.next_execution);
      const now = new Date();
      const remainingMs = Math.max(0, nextExecution.getTime() - now.getTime());
      return Math.floor(remainingMs / 1000);
    } catch (error) {
      console.error('计算周期任务倒计时失败:', error);
      return null;
    }
  }

  // 格式化周期任务信息
  formatScheduleInfo(schedule) {
    const repeatType = schedule.repeat_type || 'daily';
    const scheduleTime = schedule.schedule_time || '00:00:00';
    
    // 获取周期类型文本
    const typeMap = {
      'daily': '每天',
      'weekly': '每周', 
      'monthly': '每月'
    };
    
    let scheduleText = `${typeMap[repeatType] || repeatType} ${scheduleTime}`;
    
    // 添加特定周期的详细信息
    if (repeatType === 'weekly' && schedule.weekdays) {
      const weekdayMap = {
        'monday': '一', 'tuesday': '二', 'wednesday': '三', 'thursday': '四',
        'friday': '五', 'saturday': '六', 'sunday': '日',
        'mon': '一', 'tue': '二', 'wed': '三', 'thu': '四',
        'fri': '五', 'sat': '六', 'sun': '日'
      };
      // 过滤掉 null/undefined 值，防止 toLowerCase 报错
      const weekdaysText = schedule.weekdays
        .filter(day => day != null)
        .map(day => weekdayMap[day.toLowerCase()] || day)
        .join('、');
      scheduleText = `每周${weekdaysText} ${scheduleTime}`;
    } else if (repeatType === 'monthly' && schedule.month_days) {
      const daysText = schedule.month_days.join('、');
      scheduleText = `每月${daysText}日 ${scheduleTime}`;
    }
    
    return scheduleText;
  }

  // 获取实体的友好名称
  getEntityFriendlyName(entityId) {
    if (!entityId || !this.hass || !this.hass.states) return entityId || '';
    
    const entity = this.hass.states[entityId];
    if (!entity) return entityId;
    
    // 返回实体的友好名称，如果没有则返回entityId
    return entity.attributes?.friendly_name || entityId;
  }

  // 根据实体当前状态确定具体的 action_type（避免 auto 导致中途操作实体后动作不对）
  getConcreteActionType(entityId) {
    if (!entityId) return 'auto';
    const isClimate = entityId.startsWith('climate.');
    const isCover = entityId.startsWith('cover.');
    if (isClimate) return 'auto';
    if (isCover) return this._selectedCoverAction || 'close';

    const entity = this.hass?.states?.[entityId];
    if (!entity) return 'auto';
    const domain = entityId.split('.')[0];
    const state = entity.state;

    // media_player: 播放中关机，否则关机
    if (domain === 'media_player') {
      return state === 'playing' ? 'turn_off' : 'turn_off';
    }
    // light, switch, input_boolean 等: on→关, off→开
    if (state === 'on') return 'turn_off';
    if (state === 'off') return 'turn_on';
    return 'auto';
  }

  // 获取任务动作的显示文本（用于任务列表显示）
  getTaskActionDisplayText(task) {
    if (!task) return '';
    
    const entityId = task.entity_id;
    const actionType = task.action_type;
    const actionData = task.action_data || {};
    
    if (!entityId) return '';
    
    const domain = entityId.split('.')[0];
    
    // 空调实体
    if (domain === 'climate') {
      const modeNames = {
        'cool': '制冷',
        'heat': '制热',
        'dry': '除湿',
        'fan_only': '送风',
        'auto': '自动',
        'off': '关闭'
      };
      let text = modeNames[actionType] || '开启';
      // 如果有温度数据，添加温度
      if (actionData.temperature && actionType !== 'off') {
        text += ` ${actionData.temperature}°C`;
      }
      return `【${text}】`;
    }
    
    // 窗帘实体
    if (domain === 'cover') {
      if (actionType === 'open') return '【打开】';
      if (actionType === 'close') return '【关闭】';
      if (actionType === 'set_position') {
        return `【位置 ${actionData.position || 50}%】`;
      }
      return '【关闭】';
    }
    
    // 普通实体（light, switch, input_boolean, fan, media_player等）
    if (actionType === 'turn_on') return '【开】';
    if (actionType === 'turn_off') return '【关】';
    if (actionType === 'toggle') return '【切换】';
    
    // auto 模式：根据实体当前状态判断
    if (actionType === 'auto' || !actionType) {
      const entity = this.hass?.states?.[entityId];
      const state = entity?.state;
      if (state === 'on') return '【关】';
      if (state === 'off') return '【开】';
      return '【切换】';
    }
    
    return '';
  }





  // 新增：虚拟滚动 - 获取可见任务
  getVirtualVisibleTasks() {
    if (!this._activeTimersList || this._activeTimersList.length === 0) {
      return [];
    }
    
    const { start, end } = this._visibleRange;
    return this._activeTimersList.slice(start, end);
  }

  // 【优化】简化后的滚动处理，使用原生CSS滚动
  handleScroll() {
    // 原生CSS滚动不需要额外处理，浏览器自动处理
    // 如有需要可在此添加滚动位置记录逻辑
  }

  // 【保留但简化】获取可见任务（现在直接返回原数组）
  getVisibleTasks() {
    return this._activeTimersList || [];
  }

  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = Math.floor((now - timestamp) / 1000);
    
    if (diff < 10) return '刚刚';
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    return `${Math.floor(diff / 3600)}小时前`;
  }

  formatEndTime(endTime) {
    try {
      const endDate = new Date(endTime);
      const now = new Date();
      
      // 如果是今天，显示时间
      if (endDate.toDateString() === now.toDateString()) {
        return `今天 ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // 如果是明天，显示明天
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (endDate.toDateString() === tomorrow.toDateString()) {
        return `明天 ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // 其他情况显示日期
      return `${endDate.getMonth() + 1}月${endDate.getDate()}日 ${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
      
    } catch (error) {
      console.error('格式化结束时间失败:', error);
      return '';
    }
  }

  getTextColorBasedOnBackground(backgroundColor) {
    // 如果没有背景色，返回黑色
    if (!backgroundColor) return '#000000';
    
    // 提取RGB值
    let r, g, b;
    
    if (backgroundColor.startsWith('#')) {
      // 处理十六进制颜色
      const hex = backgroundColor.replace('#', '');
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
      } else {
        return '#000000';
      }
    } else if (backgroundColor.startsWith('rgb')) {
      // 处理RGB颜色
      const rgb = backgroundColor.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        r = parseInt(rgb[0]);
        g = parseInt(rgb[1]);
        b = parseInt(rgb[2]);
      } else {
        return '#000000';
      }
    } else {
      return '#000000';
    }
    
    // 计算亮度（使用加权平均）
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // 根据亮度选择文字颜色
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  // 【已删除】renderSettings() 方法
  // 原方法将设置弹窗渲染到 Shadow DOM，现在改为渲染到 document.body
  // 使用 _showSettingsPopup() 和 _getSettingsPopupHTML() 替代

  async startTimer() {
    try {
      if (!this._hassReady) {
        this._debugInfo = 'Hass未就绪，请稍后重试';
        console.error('Hass未就绪，无法开始定时器');
        return;
      }
      
      if (!this._selectedEntity) {
        this._debugInfo = '请先选择设备';
        this.openSettings();
        return;
      }
      
      // 移除正常状态的debug信息更新
      
      // 使用配置的default_duration值作为倒计时时间
      const defaultDuration = this.config.default_duration || '00:30:00';
      let totalSeconds;
      let durationToSend;
      
      if (this._timerMode === 'absolute_time') {
        // 指定时间模式：计算绝对时间与当前时间的差值
        const targetTime = this.parseAbsoluteTime(defaultDuration);
        if (targetTime) {
          const now = new Date();
          totalSeconds = Math.max(0, Math.floor((targetTime.getTime() - now.getTime()) / 1000));
          // 将倒计时转换为 HH:MM:SS 格式发送给后端
          durationToSend = this.secondsToDuration(totalSeconds);
        } else {
          // 如果解析失败，使用默认的倒计时逻辑
          totalSeconds = this.durationToSeconds(defaultDuration);
          durationToSend = defaultDuration;
        }
      } else if (this._timerMode === 'recurring') {
        // 周期定时模式：使用配置的default_duration时间
        totalSeconds = this.durationToSeconds(defaultDuration);
        durationToSend = defaultDuration;
      } else {
        // 倒计时模式：直接使用配置的default_duration时间
        totalSeconds = this.durationToSeconds(defaultDuration);
        durationToSend = defaultDuration;
      }
      
      this._totalSeconds = totalSeconds;
      this._remainingSeconds = totalSeconds;
      this._progress = 100;
      this._pendingTimerRestore = false;
      
      // 创建临时定时器信息
      this._timerInfo = {
        entity_id: this._selectedEntity,
        duration: durationToSend,
        action: '定时器运行中',
        remaining_seconds: this._remainingSeconds,
        end_time: new Date(Date.now() + this._totalSeconds * 1000).toISOString()
      };
      
      this.requestUpdate();

      // 构建事件数据 - 根据实体当前状态确定具体 action_type，避免 auto 导致中途操作实体后动作不对
      let defaultActionType = this.getConcreteActionType(this._selectedEntity);

      const eventData = {
        action: 'create_timer',
        entity_id: this._selectedEntity,
        duration: durationToSend,
        action_type: defaultActionType,
        user_id: 'user'
      };

      // 如果是空调实体，添加动作配置
      if (this._selectedEntity && this._selectedEntity.startsWith('climate.') && this._selectedClimateMode !== undefined && this._selectedTemperature !== undefined) {
        // 根据模式构建不同的动作配置
        if (this._selectedClimateMode === 'off') {
          // 关闭模式：使用 turn_off 动作
          eventData.action_config = {
            turn_off: {
              service: 'climate.turn_off',
              data: {
                entity_id: this._selectedEntity
              }
            }
          };
        } else {
          // 其他模式：设置模式和温度（两个动作）
          // 格式与后端 apps.yaml 配置保持一致
          eventData.action_config = {
            set_mode: {
              service: 'climate.set_hvac_mode',
              data: {
                entity_id: this._selectedEntity,
                hvac_mode: this._selectedClimateMode
              }
            },
            set_temperature: {
              service: 'climate.set_temperature',
              data: {
                entity_id: this._selectedEntity,
                temperature: this._selectedTemperature
              }
            }
          };
        }
      } else if (isCover) {
        // 如果是窗帘实体，添加动作配置
        const coverAction = this._selectedCoverAction || 'close';
        const coverPosition = (this._selectedCoverPosition !== undefined && this._selectedCoverPosition !== null) ? this._selectedCoverPosition : 50;

        // 根据动作构建不同的配置
        if (coverAction === 'set_position') {
          // 设置位置动作
          eventData.action_type = 'set_position';
          eventData.action_data = {
            position: coverPosition
          };
        } else if (coverAction === 'close' || coverAction === 'open') {
          // 关闭或打开动作
          eventData.action_type = coverAction;
        } else {
          // 默认关闭
          eventData.action_type = 'close';
        }
      }

      // 发送创建定时器的事件
      await this.sendEventSafe(eventData);

      // 【优化】移除立即刷新，等待后端事件响应后再更新
      // 避免短时间内发送大量同步请求导致消息堆积
      
    } catch (error) {
      this._debugInfo = `开始定时器失败: ${error.message}`;
    }
  }

  async cancelTimer() {
    try {
      if (!this._hassReady) {
        this._debugInfo = 'Hass未就绪，请稍后重试';
        console.error('Hass未就绪，无法取消定时器');
        return;
      }
      
      if (!this._timerInfo) {
        throw new Error('没有活动的定时器');
      }
      
      if (!this._selectedEntity) {
        throw new Error('未选择设备');
      }
      
      // 移除正常状态的debug信息更新
      
      // 发送取消事件，确保包含用户ID
      await this.sendEventSafe({
        action: 'cancel_entity_timer',
        entity_id: this._selectedEntity,
        user_id: 'user'
      });

      // 在发送请求后清除本地状态
      this._timerInfo = null;
      this._timer = null;
      this._remainingSeconds = 0;
      this._progress = 100;
      this._pendingTimerRestore = false;
      this.requestUpdate();

      // 【优化】移除立即刷新，等待后端事件响应后再更新
      // 避免短时间内发送大量同步请求导致消息堆积
    } catch (error) {
      this._debugInfo = `取消定时器失败: ${error.message}`;
    }
  }

  handleResponse(event) {
    // 处理 Home Assistant 事件格式
    let data;
    if (event.data) {
      data = event.data;
    } else if (event.detail) {
      data = event.detail;
    } else {
      return;
    }
    
    this._lastSyncTime = Date.now();
    
    if (data && data.action) {
      this._backendConnected = true;
      this._lastSyncSuccessTime = Date.now();
      this._lastSyncFailed = false;  // 重置同步失败状态
      
      if (data.action === 'timers_list') {
        // 调试日志（仅当 show_debug 为 true 时输出）
        if (this.config.show_debug) {
          console.log('[handleResponse] 收到timers_list响应');
          console.log('[handleResponse] data.schedules:', JSON.stringify(data.schedules, null, 2));
        }

        // 更新正在执行的任务列表
        this._activeTimersList = data.timers?.filter(t =>
          t.status === 'running' ||
          (t.remaining_seconds && t.remaining_seconds > 0) ||
          (t.end_time && new Date(t.end_time).getTime() > Date.now())
        ) || [];

        // 更新周期任务列表
        this._activeSchedulesList = data.schedules?.filter(s =>
          s.status === 'active'
        ) || [];

        // 调试日志（仅当 show_debug 为 true 时输出）
        if (this.config.show_debug) {
          console.log('[handleResponse] _activeSchedulesList:', JSON.stringify(this._activeSchedulesList.map(s => ({
            schedule_id: s.schedule_id,
            schedule_time: s.schedule_time,
            repeat_type: s.repeat_type
          })), null, 2));
        }

        // 将周期任务转换为任务格式，用于统一显示
        const scheduleTasks = this._activeSchedulesList.map(schedule => ({
          ...schedule,
          is_schedule: true,
          schedule_countdown: this.calculateScheduleCountdown(schedule),
          schedule_info: this.formatScheduleInfo(schedule)
        }));

        // 合并任务列表（用于normal-container显示）
        const allTasks = [...this._activeTimersList, ...scheduleTasks];

        // 更新正在执行的任务个数（包含周期任务）
        this._activeTimersCount = allTasks.length;
        
        // 使用合并后的任务列表（用于normal-container显示）
        this._activeTimersList = allTasks;
        
        // 刷新外部任务列表弹窗（如果存在）
        if (this._externalTaskListPopup) {
          this._refreshTaskListPopup();
        }
        
        // 【移除】3D滚动已改为普通CSS滚动，不再需要JS控制
        
        // 【已整合】周期任务倒计时更新已整合到统一时间控制器
        // 不再需要独立的 startScheduleUpdate，统一控制器每5秒调用 updateScheduleCountdowns
        
        // 优化：根据是否有任务智能启停统一时间控制器
        if (this._hasActiveTasks()) {
          if (!this._unifiedInterval) {
            this.startUnifiedTimerController();
          }
        } else {
          // 没有任务时停止统一时间控制器
          this.stopUnifiedTimerController();
        }
        
        // 找到当前实体的定时器
        const newTimer = data.timers?.find(t => t.entity_id === this._selectedEntity);
        
        if (newTimer) {
          this._timerInfo = newTimer;
          this._timer = newTimer;
          
          // 计算总时长
          if (newTimer.duration) {
            this._totalSeconds = this.durationToSeconds(newTimer.duration);
          }
          
          // 【优化】不再在这里设置 _remainingSeconds
          // updateCountdown() 会基于 _timerInfo.end_time 实时计算，避免重复计算和时间跳动
          // 只有在没有 end_time 时才从后端的 remaining_seconds 初始化一次
          if (!newTimer.end_time && newTimer.remaining_seconds !== undefined) {
            this._remainingSeconds = Math.max(0, Math.floor(newTimer.remaining_seconds));
          }
          
          // 清除超时定时器
          if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
            this._syncTimeout = null;
          }
          
          // 重置重试计数
          this._retryCount = 0;
          this._pendingTimerRestore = false;
          
          // 使用防抖更新
          this.requestUpdateDebounced();
        } else {
          // 如果没有找到当前实体的定时器，清除状态
          this._timerInfo = null;
          this._timer = null;
          this._remainingSeconds = 0;
          this._progress = 100;
          this._pendingTimerRestore = false;
          
          // 清除超时定时器
          if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
            this._syncTimeout = null;
          }
          
          // 重置重试计数
          this._retryCount = 0;
          
          // 使用防抖更新
          this.requestUpdateDebounced();
        }
      } else if (data.action === 'timer_created') {
        if (data.entity_id === this.config.entity) {
          // 立即刷新状态
          setTimeout(() => {
            this.refreshTimersWithRetry();
          }, 500);
        }
      } else if (data.action === 'timer_cancelled') {
        if (data.entity_id === this.config.entity) {
          this._timerInfo = null;
          this._timer = null;
          this._remainingSeconds = 0;
          this._progress = 100;
          this._pendingTimerRestore = false;
          
          // 使用防抖更新
          this.requestUpdateDebounced();
          
          // 优化：取消后检查是否需要停止定时器
          setTimeout(() => {
            this.refreshTimersWithRetry();
          }, 500);
        }
      } else if (data.action === 'timer_completed') {
        if (data.entity_id === this.config.entity) {
          this._timerInfo = null;
          this._timer = null;
          this._remainingSeconds = 0;
          this._progress = 100;
          this._pendingTimerRestore = false;
          
          // 使用防抖更新
          this.requestUpdateDebounced();
          
          // 优化：完成后检查是否需要停止定时器
          setTimeout(() => {
            this.refreshTimersWithRetry();
          }, 500);
        }
      } else if (data.action === 'schedule_created') {
        // 周期任务创建成功，刷新任务列表
        setTimeout(() => {
          this.refreshTimersWithRetry();
        }, 500);
      } else if (data.action === 'schedule_cancelled') {
        // 周期任务取消成功，刷新任务列表
        setTimeout(() => {
          this.refreshTimersWithRetry();
        }, 500);
      } else if (data.action === 'schedule_executed') {
        // 周期任务执行完成，刷新任务列表
        setTimeout(() => {
          this.refreshTimersWithRetry();
        }, 500);
      } else if (data.action === 'schedules_list') {
        // 更新周期任务列表
        this._activeSchedulesList = data.schedules?.filter(s =>
          s.status === 'active'
        ) || [];
        this._activeTimersCount = this._activeTimersList.length + this._activeSchedulesList.length;
        
        // 使用防抖更新
        this.requestUpdateDebounced();
      } else if (data.action === 'error') {
        console.error('后端返回错误:', data.error);
        this._debugInfo = `后端错误: ${data.error}`;
        this._lastSyncFailed = true;
      }
    } else {
      console.warn('收到未知格式的响应:', data);
      this._debugInfo = '收到未知响应';
      this._lastSyncFailed = true;
    }
  }

  openSettings() {
    this._showSettings = true;
    this._selectedAction = 'auto'; // 重置动作选择为自动
    this._showSettingsPopup();
  }

  openAddTimer() {
    this._showSettings = true;
    this._selectedAction = 'auto'; // 重置动作选择为自动
    this._showSettingsPopup();
  }

  closeSettings() {
    this._showSettings = false;
    this._removeSettingsPopup();
  }

  toggleTaskList(event) {
    // 防止事件冒泡导致的重复弹出
    // 如果点击的是弹窗overlay层（popup-overlay），直接返回
    const isOverlay = event && event.target && 
      (event.target.classList.contains('popup-overlay') || 
       event.target.closest('.popup-overlay'));
    
    if (isOverlay) {
      return;
    }
    
    // 如果弹窗已经显示，点击normal-container时不切换状态（防止重复弹出）
    if (this._showTaskList) {
      return;
    }
    
    // 检查点击的目标是否是progress-bar元素
    const isProgressBar = event && event.target && 
      (event.target.classList.contains('progress-bar') || 
       event.target.closest('.progress-bar'));
    
    // 如果是点击progress-bar，不触发弹窗显示
    if (isProgressBar) {
      return;
    }
    
    // 检查是否使用 pull-down 模式（mini模式 + second_style为pull-down）
    const usePullDownMode = this.config.card_style === 'mini' && 
                           this.config.second_style === 'pull-down';
    
    // pull-down 模式下，点击时间框不触发弹窗（下拉选择器直接在主界面中）
    if (usePullDownMode) {
      return;
    }
    
    // 显示任务列表弹窗（渲染到 document.body）
    this._showTaskList = true;
    this._showTaskListPopup();
  }

  closeTaskList() {
    this._showTaskList = false;
    this._removeTaskListPopup();
  }

  // 清除所有历史记录
  async clearAllHistory() {
    try {
      if (!this.hass || !this.hass.connection) {
        throw new Error('Hass连接不可用');
      }

      // 发送清除历史记录事件到后端
      this.hass.connection.sendMessage({
        type: 'fire_event',
        event_type: 'timer_backend_event',
        event_data: {
          action: 'clear_all_history',
          user_id: 'user'
        }
      });

      // 关闭任务列表弹窗
      this.closeTaskList();

      // 等待后端处理完成
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 刷新定时器列表
      await this.refreshTimersWithRetry();

    } catch (error) {
      console.error('清除历史记录失败:', error);
      alert('清除历史记录失败: ' + error.message);
    }
  }

  // ========== 外部弹窗渲染方法（渲染到 document.body）==========

  // 注入弹窗样式到 document.head
  _injectPopupStyles() {
    if (this._popupStylesInjected) return;
    
    // 检查是否已存在样式
    if (document.getElementById('timer-control-card-popup-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'timer-control-card-popup-styles';
    styleEl.textContent = `
      /* 弹窗样式 - 渲染到 document.body - 支持主题切换 */
      .timer-popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--timer-overlay-bg, rgba(0,0,0,0.4));
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        animation: fadeIn 0.3s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .timer-popup {
        background: var(--timer-popup-bg, #ffffff);
        border-radius: 14px;
        padding: 0;
        width: 90%;
        max-width: 480px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: var(--timer-popup-shadow, 0 10px 30px rgba(0,0,0,0.15));
        animation: slideUp 0.4s ease;
        border: 1px solid var(--timer-popup-border, rgba(0,0,0,0.1));
      }
      
      @keyframes slideUp {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .timer-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 20px 0px 20px;
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
        border-radius: 14px 14px 0 0;
      }
      
      .timer-popup-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--timer-primary-text, #000000);
        letter-spacing: -0.3px;
      }
      
      .timer-popup-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--timer-secondary-text, #8e8e93);
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
      }
      
      .timer-popup-close:hover {
        background: var(--timer-hover-bg, #f2f2f7);
        color: var(--timer-primary-text, #000000);
      }
      
      /* 任务列表弹窗样式 */
      .timer-task-list-popup {
        background: var(--timer-popup-bg, #ffffff);
        border-radius: 14px;
        width: 90%;
        max-width: 500px;
        max-height: 70vh;
        overflow: hidden;
        box-shadow: var(--timer-popup-shadow, 0 10px 30px rgba(0,0,0,0.15));
        animation: slideUp 0.4s ease;
        border: 1px solid var(--timer-popup-border, rgba(0,0,0,0.1));
      }
      
      .timer-task-list-popup.has-tasks {
        background: var(--timer-popup-bg, #fffacd);
        color: var(--timer-primary-text, #ffffff);
      }
      
      .timer-task-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 20px;
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
      }
      
      .timer-task-list-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--timer-primary-text, #000000);
        letter-spacing: -0.3px;
      }
      
      .timer-task-list-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--timer-secondary-text, #8e8e93);
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
      }
      
      .timer-task-list-close:hover {
        background: var(--timer-hover-bg, #f2f2f7);
        color: var(--timer-primary-text, #000000);
      }
      
      .timer-task-list-content {
        padding: 0;
        max-height: calc(70vh - 60px);
        overflow-y: auto;
      }
      
      .timer-task-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      
      .timer-task-table th {
        padding: 8px 4px;
        text-align: left;
        font-weight: 600;
        color: var(--timer-primary-text, #000000);
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
        letter-spacing: -0.2px;
      }
      
      .timer-task-table tbody tr {
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
        transition: background-color 0.2s ease;
      }
      
      .timer-task-table tbody tr:hover {
        background: var(--timer-hover-bg, #f2f2f7);
      }
      
      .timer-task-table tbody tr:last-child {
        border-bottom: none;
      }
      
      .timer-task-table td {
        padding: 6px 3px;
        vertical-align: middle;
      }
      
      .timer-entity-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      
      .timer-entity-name {
        font-size: 12px;
        font-weight: 500;
        color: var(--timer-primary-text, #000000);
        letter-spacing: -0.2px;
      }
      
      .timer-entity-id {
        font-size: 10px;
        color: var(--timer-secondary-text, #8e8e93);
        font-weight: 400;
      }
      
      .timer-time-display {
        font-size: 16px;
        font-weight: 600;
        color: var(--timer-time-display-color, #007aff);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.2px;
      }
      
      .timer-task-actions {
        display: flex;
        gap: 8px;
        justify-content: center;
      }
      
      .timer-task-cancel-btn {
        padding: 4px 12px;
        font-size: 11px;
        background: var(--timer-danger-color, #ff3b30);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        min-width: 60px;
      }
      
      .timer-task-cancel-btn:hover {
        opacity: 0.85;
        transform: translateY(-1px);
      }
      
      .timer-task-modify-btn {
        padding: 4px 12px;
        font-size: 11px;
        background: var(--timer-accent-color, #007aff);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        min-width: 60px;
      }
      
      .timer-task-modify-btn:hover {
        opacity: 0.85;
        transform: translateY(-1px);
      }
      
      .timer-task-cancel-all-btn {
        padding: 4px 12px;
        font-size: 11px;
        background: var(--timer-warning-color, #ff9500);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        min-width: 60px;
      }
      
      .timer-task-cancel-all-btn:hover {
        opacity: 0.85;
        transform: translateY(-1px);
      }
      
      /* 历史记录按钮样式 */
      .timer-task-history-btn {
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      
      .timer-task-history-btn:hover {
        opacity: 0.85;
        transform: translateY(-1px);
      }
      
      /* 历史记录表格样式 */
      .timer-history-table tbody tr.history-success {
        background: rgba(40, 167, 69, 0.08);
      }
      
      .timer-history-table tbody tr.history-failed {
        background: rgba(255, 59, 48, 0.08);
      }
      
      .timer-history-table tbody tr.history-cancelled {
        background: rgba(255, 149, 0, 0.08);
      }
      
      .timer-history-table tbody tr.history-unknown {
        background: rgba(142, 142, 147, 0.08);
      }
      
      .timer-history-action {
        font-size: 11px;
        font-weight: 500;
        color: var(--timer-primary-text, #000000);
      }
      
      .timer-history-result {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        font-size: 12px;
        font-weight: 600;
      }
      
      .timer-history-result.history-success {
        background: rgba(40, 167, 69, 0.2);
        color: var(--timer-success-color, #28a745);
      }
      
      .timer-history-result.history-failed {
        background: rgba(255, 59, 48, 0.2);
        color: var(--timer-danger-color, #ff3b30);
      }
      
      .timer-history-result.history-cancelled {
        background: rgba(255, 149, 0, 0.2);
        color: var(--timer-warning-color, #ff9500);
      }
      
      .timer-history-result.history-unknown {
        background: rgba(142, 142, 147, 0.2);
        color: var(--timer-secondary-text, #8e8e93);
      }
      
      .timer-empty-state {
        padding: 60px 20px;
        text-align: center;
        color: var(--timer-empty-state-text, #8e8e93);
      }
      
      .timer-empty-state-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
      
      .timer-empty-state-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--timer-primary-text, #000000);
        letter-spacing: -0.2px;
      }
      
      .timer-empty-state-subtitle {
        font-size: 15px;
        color: var(--timer-empty-state-text, #8e8e93);
        font-weight: 400;
      }
      
      /* 设备选择section样式 */
      .timer-device-selection-section {
        padding: 10px 20px 0px 20px;
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
      }
      
      .timer-device-section-title {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 2px;
        color: var(--timer-primary-text, #000000);
        letter-spacing: -0.2px;
      }
      
      /* 分类标签样式 */
      .timer-category-tabs {
        display: flex;
        background: var(--timer-tab-bg, #f2f2f7);
        border-radius: 8px;
        padding: 4px;
        margin-bottom: 15px;
      }
      
      .timer-category-tab {
        flex: 1;
        padding: 8px 12px;
        text-align: center;
        cursor: pointer;
        border: none;
        background: transparent;
        font-size: 11px;
        color: var(--timer-secondary-text, #8e8e93);
        border-radius: 6px;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      
      .timer-category-tab:hover {
        background: var(--timer-hover-bg, rgba(0,0,0,0.05));
        color: var(--timer-primary-text, #000000);
      }
      
      .timer-category-tab.active {
        background: var(--timer-tab-active-bg, #ffffff);
        color: var(--timer-tab-active-text, #007aff);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        font-weight: 600;
      }
      
      .timer-entity-categories {
        flex: 1;
        height: 200px;
        overflow-y: auto;
      }
      
      .timer-entity-list {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      
      .timer-entity-item {
        padding: 5px 16px;
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
      }
      
      .timer-entity-item:last-child {
        border-bottom: none;
      }
      
      .timer-entity-item:hover {
        background: var(--timer-entity-item-hover, #f2f2f7);
      }
      
      .timer-entity-item.selected {
        background: var(--timer-active-bg, #007aff);
        color: var(--timer-active-text, #ffffff);
      }
      
      .timer-entity-item .timer-entity-name {
        font-size: 10px;
        font-weight: 500;
        color: var(--timer-primary-text, #000000);
        margin-bottom: 2px;
        letter-spacing: -0.2px;
      }
      
      .timer-entity-item .timer-entity-id {
        font-size: 10px;
        opacity: 0.7;
        color: var(--timer-primary-text, #000000);
      }
      
      .timer-entity-item.selected .timer-entity-name,
      .timer-entity-item.selected .timer-entity-id {
        color: var(--timer-active-text, #ffffff);
      }
      
      /* 定时时长section样式 */
      .timer-duration-section {
        padding: 10px 15px 22px 20px;
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
      }
      
      .timer-duration-section-title {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 2px;
        color: var(--timer-primary-text, #000000);
        letter-spacing: -0.2px;
      }
      
      .timer-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .timer-mode-buttons {
        display: flex;
        gap: 8px;
        background: var(--timer-tab-bg, #f2f2f7);
        border-radius: 8px;
        padding: 4px;
      }
      
      .timer-mode-btn {
        padding: 8px 16px;
        font-size: 11px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--timer-secondary-text, #8e8e93);
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      
      .timer-mode-btn:hover {
        background: var(--timer-hover-bg, rgba(0,0,0,0.05));
        color: var(--timer-primary-text, #000000);
      }
      
      .timer-mode-btn.active {
        background: var(--timer-tab-active-bg, #ffffff);
        color: var(--timer-tab-active-text, #007aff);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        font-weight: 600;
      }
      
      .timer-duration-container {
        display: flex;
        gap: 15px;
        margin-bottom: 15px;
        padding: 0px 5px;
        height: 60px;
      }
      
      .timer-time-inputs {
        flex: 1;
        display: flex;
        gap: 1px;
        align-items: center;
        margin-left: 20px;
        margin-top: 30px;
        
        /* 移动端适配 - 左对齐 */
        @media (max-width: 768px) {
          margin-left: 0;
          margin-top: 0px;
          justify-content: flex-start;
          gap: 5px;
          flex: none;
          width: auto;
        }
        
        @media (max-width: 480px) {
          gap: 3px;
          justify-content: flex-start;
          flex: none;
          width: auto;
        }
      }
      
      /* 周期定时模式下的翻页钟样式 */
      .timer-interval-options ~ .timer-time-inputs {
        margin-top: 0px;
      }
      
      .timer-colon-separator {
        font-size: 16px;
        font-weight: bold;
        color: var(--timer-primary-text);
        margin: 0 5px;
      }
      
      /* 翻页钟样式 */
      .timer-flip-clock-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0px;
      }
      
      .timer-flip-clock-input {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        position: relative;
        width: 40px;
        height: 60px;
        perspective: 200px;
        cursor: default;
      }
      
      .timer-flip-clock-card {
        position: relative;
        width: 110%;
        height: 100%;
        transform-style: preserve-3d;
        transition: transform 0.3s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      
      .timer-flip-clock-face {
        position: absolute;
        width: 100%;
        height: 100%;
        backface-visibility: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: bold;
        color: #ffffff;
        background: #000000;
        border: 1px solid #333333;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transform: scaleX(1.5) scaleY(0.8);
      }
      
      .timer-flip-clock-top,
      .timer-flip-clock-bottom {
        position: absolute;
        left: 0;
        right: 0;
        height: 30px;
        cursor: pointer;
        z-index: 2;
      }
      
      .timer-flip-clock-top {
        top: 0;
        border-radius: 4px 4px 0 0;
      }
      
      .timer-flip-clock-bottom {
        bottom: 0;
        border-radius: 0 0 4px 4px;
      }
      
      .timer-flip-clock-input::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 1px;
        background: #666666;
        z-index: 1;
      }
      
      .timer-flip-clock-top:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .timer-flip-clock-bottom:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      .timer-flip-clock-face.front {
        transform: rotateX(0deg);
      }
      
      .timer-flip-clock-face.back {
        transform: rotateX(180deg);
      }
      
      .timer-flip-clock-card.flipping .front {
        transform: rotateX(-180deg);
      }
      
      .timer-flip-clock-card.flipping .back {
        transform: rotateX(0deg);
      }
      
      .timer-flip-clock-input:hover {
        cursor: pointer;
      }
      
      .timer-flip-clock-input:hover .timer-flip-clock-face {
        /* 移除背景色变化，保持黑色背景不变 */
      }
      
      .timer-flip-clock-card.flipping {
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      
      /* 快速选择按钮 */
      .timer-quick-durations {
        width: 266px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      
      .timer-quick-btn {
        padding: 12px 8px;
        background: var(--timer-tab-bg, #f2f2f7);
        border: 1px solid transparent;
        border-radius: 10px;
        cursor: pointer;
        font-size: 11px;
        color: var(--timer-primary-text, #000000);
        transition: all 0.3s ease;
        font-weight: 500;
        letter-spacing: -0.2px;
        height: 40px;
      }
      
      .timer-quick-btn:hover {
        background: var(--timer-hover-bg, #e5e5ea);
        transform: translateY(-1px);
      }
      
      /* 周期定时样式 */
      .timer-interval-options {
        display: flex;
        flex-direction: row;
        gap: 15px;
        justify-content: center;
        align-items: center;
        padding: 0 20px;
        margin-bottom: 0px;
        position: relative;
        overflow: visible;
        
        @media (max-width: 480px) {
          gap: 10px;
          padding: 1px 5px;
          margin-top: 0px;
        }
      }
      
      .timer-recurring-options {
        position: relative;
        overflow: visible;
      }
      
      .timer-interval-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        transition: all 0.3s ease;
        background: var(--timer-tab-bg, #f2f2f7);
        flex: none;
        border: 1px solid transparent;
        width: 25px;
        position: relative;
        
        @media (max-width: 768px) {
          min-width: 45px;
          max-width: 45px;
          width: 45px;
          padding: 6px 8px;
        }
        
        @media (max-width: 480px) {
          min-width: 40px;
          max-width: 40px;
          width: 40px;
          padding: 4px 6px;
        }
      }
      
      .timer-interval-option:hover {
        background: var(--timer-hover-bg, #e5e5ea);
        transform: translateY(-1px);
      }
      
      .timer-interval-option input[type="radio"]:checked + .timer-interval-label {
        color: var(--timer-tab-active-text, #007aff);
        font-weight: 600;
      }
      
      .timer-interval-option input[type="radio"] {
        accent-color: var(--timer-accent-color, #007aff);
        width: 16px;
        height: 16px;
        
        @media (max-width: 768px) {
          width: 14px;
          height: 14px;
        }
        
        @media (max-width: 480px) {
          width: 12px;
          height: 12px;
        }
      }
      
      .timer-interval-label {
        font-size: 11px;
        color: var(--timer-primary-text, #000000);
        font-weight: 500;
        letter-spacing: -0.2px;
        
        @media (max-width: 768px) {
          font-size: 10px;
        }
        
        @media (max-width: 480px) {
          font-size: 9px;
        }
      }
      
      /* 星期选择 */
      .timer-days-selection {
        padding: 0 20px;
        margin-bottom: 15px;
        
        @media (max-width: 480px) {
          margin-bottom: 0px;
        }
      }
      
      .timer-days-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 5px;
        margin-top: 3px;
        height: 30px;
      }
      
      .timer-day-btn {
        padding: 8px 0;
        border: 1px solid var(--timer-divider, #c6c6c8);
        border-radius: 6px;
        cursor: pointer;
        font-size: 10px;
        color: var(--timer-primary-text, #000000);
        background: var(--timer-tab-active-bg, #ffffff);
        transition: all 0.3s ease;
        font-weight: 500;
        text-align: center;
        
        @media (max-width: 768px) {
          width: 20px;
          margin-top: 10px;
        }
      }
      
      .timer-day-btn:hover {
        background: var(--timer-hover-bg, #f2f2f7);
        transform: translateY(-1px);
      }
      
      .timer-day-btn.selected {
        background: var(--timer-active-bg, #007aff);
        color: var(--timer-active-text, #ffffff);
        border-color: var(--timer-active-bg, #007aff);
      }
      
      /* 每月日期选择网格 */
      .timer-monthly-grid-dropdown {
        display: grid;
        grid-template-columns: repeat(11, 1fr);
        grid-template-rows: repeat(3, auto);
        gap: 8px;
        padding: 10px;
        background: var(--timer-popup-bg, #ffffff);
        border-radius: 8px;
        border: 1px solid var(--timer-divider, #c6c6c8);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideDown 0.2s ease;
        position: absolute;
        top: 110%;
        left: -197px;
        margin-top: 8px;
        z-index: 1000;
        min-width: 395px;
        width: 100%;
        visibility: visible;
        opacity: 1;
        
        @media (max-width: 768px) {
          grid-template-columns: repeat(11, 1fr);
          gap: 3px;
          padding: 10px;
          top: 110%;
          left: -147px;
          margin-top: 8px;
          z-index: 1000;
          min-width: 355px;
        }
        
        @media (max-width: 480px) {
          grid-template-columns: repeat(11, 1fr);
          gap: 2px;
          padding: 10px;
          top: 110%;
          left: -190px;
          margin-top: 8px;
          z-index: 1000;
          min-width: 355px;
        }
      }
      
      @keyframes slideDown {
        from { 
          opacity: 0; 
          transform: translateY(-10px); 
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
      
      .timer-monthly-day-btn {
        border: 1px solid var(--timer-divider, #c6c6c8);
        border-radius: 6px;
        background: var(--timer-tab-active-bg, #ffffff);
        color: var(--timer-primary-text, #000000);
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
        
        @media (max-width: 480px) {
          padding: 4px 1px;
          font-size: 10px;
          min-height: 20px;
          width: 25px;
          height: 25px;
        }
      }
      
      .timer-monthly-day-btn:hover {
        background: var(--timer-hover-bg, #f2f2f7);
        border-color: var(--timer-accent-color, #007aff);
        transform: translateY(-1px);
      }
      
      .timer-monthly-day-btn.selected {
        background: var(--timer-active-bg, #007aff);
        color: var(--timer-active-text, #ffffff);
        border-color: var(--timer-active-bg, #007aff);
        font-weight: 600;
        transform: scale(1.05);
      }
      
      .timer-monthly-day-btn.selected:hover {
        opacity: 0.85;
      }
      
      .timer-monthly-close-btn {
        background: var(--timer-danger-color, #ff3b30) !important;
        color: #ffffff !important;
        border-color: var(--timer-danger-color, #ff3b30) !important;
        font-weight: bold;
      }
      
      .timer-monthly-close-btn:hover {
        opacity: 0.85;
        transform: scale(1.1);
      }
      
      .timer-monthly-confirm-btn {
        background: var(--timer-success-color, #34c759) !important;
        color: #ffffff !important;
        border-color: var(--timer-success-color, #34c759) !important;
        font-weight: bold;
        font-size: 14px !important;
      }
      
      .timer-monthly-confirm-btn:hover {
        opacity: 0.85;
        transform: scale(1.1);
      }
      
      /* 定时动作section样式 */
      .timer-action-section {
        padding: 10px 5px 10px 20px;
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
      }
      
      .timer-action-section-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--timer-primary-text, #000000);
        letter-spacing: -0.2px;
      }
      
      .timer-action-options {
        display: flex;
        flex-direction: row;
        gap: 20px;
        justify-content: space-between;
        align-items: center;
        padding: 5px;
      }
      
      .timer-action-option {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        padding: 10px;
        border-radius: 10px;
        transition: all 0.3s ease;
        background: var(--timer-tab-bg, #f2f2f7);
        flex: 1;
        border: 2px solid transparent;
        height: 20px;
      }
      
      .timer-action-option:hover {
        background: var(--timer-hover-bg, #e5e5ea);
        transform: translateY(-1px);
      }
      
      .timer-action-option input[type="radio"] {
        accent-color: var(--timer-accent-color, #007aff);
        width: 18px;
        height: 18px;
      }
      
      .timer-action-label {
        font-size: 11px;
        color: var(--timer-primary-text, #000000);
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      
      /* 空调动作样式 */
      .timer-climate-action-container {
        display: flex;
        flex-direction: row;
        gap: 2px;
        padding: 2px 0;
      }
      
      .timer-climate-modes-section {
        flex: 6;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .timer-climate-modes-title {
        font-size: 11px;
        font-weight: 500;
        color: var(--timer-secondary-text, #8e8e93);
        letter-spacing: -0.2px;
      }
      
      .timer-climate-modes {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-start;
      }
      
      .timer-climate-mode-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 35px;
        height: 35px;
        border: 2px solid var(--timer-divider, #e5e5ea);
        border-radius: 10px;
        background: var(--timer-tab-active-bg, #ffffff);
        cursor: pointer;
        transition: all 0.3s ease;
        padding: 0;
      }
      
      .timer-climate-mode-btn:hover {
        background: var(--timer-hover-bg, #f2f2f7);
        border-color: var(--timer-accent-color, #007aff);
      }
      
      .timer-climate-mode-btn.active {
        border-color: var(--timer-accent-color, #007aff);
        background: var(--timer-hover-bg, #e3f2fd);
        color: var(--timer-accent-color, #007aff);
      }
      
      .timer-climate-mode-btn ha-icon {
        font-size: 23px;
        color: var(--timer-secondary-text, #8e8e93);
      }
      
      .timer-climate-mode-btn.active ha-icon {
        color: var(--timer-accent-color, #007aff);
      }
      
      .timer-climate-temperature-section {
        flex: 4;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .timer-climate-temperature-title {
        font-size: 11px;
        font-weight: 500;
        color: var(--timer-secondary-text, #8e8e93);
        letter-spacing: -0.2px;
      }
      
      .timer-temperature-slider-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 5px 0;
        position: relative;
      }
      
      .timer-slider-wrapper {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        overflow: visible;
        width: 100%;
      }
      
      .timer-temperature-slider {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: var(--timer-slider-bg, #e5e5ea);
        appearance: none;
        outline: none;
        -webkit-appearance: none;
        position: relative;
        z-index: 1;
      }
      
      .timer-temperature-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 40px;
        height: 24px;
        border-radius: 6px;
        background: var(--timer-accent-color, #007aff);
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 122, 255, 0.3);
        transition: transform 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .timer-temperature-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }
      
      .timer-temperature-display {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 11px;
        font-weight: 600;
        color: var(--timer-active-text, #ffffff);
        padding: 3px 8px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        max-width: 50px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      
      .timer-temperature-labels-container {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-top: 2px;
      }
      
      .timer-temperature-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--timer-secondary-text, #8e8e93);
        min-width: 30px;
        text-align: center;
      }
      
      .timer-temperature-label.min-label {
        text-align: left;
      }
      
      .timer-temperature-label.max-label {
        text-align: right;
      }
      
      /* 窗帘动作样式 */
      .timer-cover-action-container {
        display: flex;
        flex-direction: row;
        gap: 2px;
        padding: 2px 0;
      }
      
      .timer-cover-actions-section {
        flex: 6;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .timer-cover-actions-title {
        font-size: 11px;
        font-weight: 500;
        color: var(--timer-secondary-text, #8e8e93);
        letter-spacing: -0.2px;
        margin-bottom: 10px;
      }
      
      .timer-cover-actions {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-start;
      }
      
      .timer-cover-action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 35px;
        height: 35px;
        border: 2px solid var(--timer-divider, #e5e5ea);
        border-radius: 10px;
        background: var(--timer-tab-active-bg, #ffffff);
        cursor: pointer;
        transition: all 0.3s ease;
        padding: 0;
      }
      
      .timer-cover-action-btn:hover {
        background: var(--timer-hover-bg, #f2f2f7);
        border-color: var(--timer-accent-color, #007aff);
      }
      
      .timer-cover-action-btn.active {
        border-color: var(--timer-accent-color, #007aff);
        background: var(--timer-hover-bg, #e3f2fd);
        color: var(--timer-accent-color, #007aff);
      }
      
      .timer-cover-action-btn ha-icon {
        font-size: 23px;
        color: var(--timer-secondary-text, #8e8e93);
      }
      
      .timer-cover-action-btn.active ha-icon {
        color: var(--timer-accent-color, #007aff);
      }
      
      .timer-cover-position-section {
        flex: 4;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .timer-cover-position-title {
        font-size: 11px;
        font-weight: 500;
        color: var(--timer-secondary-text, #8e8e93);
        letter-spacing: -0.2px;
      }
      
      .timer-position-slider-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 5px 0;
        position: relative;
      }
      
      .timer-position-slider {
        flex: 1;
        height: 6px;
        border-radius: 3px;
        background: var(--timer-slider-bg, #e5e5ea);
        appearance: none;
        outline: none;
        -webkit-appearance: none;
        position: relative;
        z-index: 1;
      }
      
      .timer-position-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 40px;
        height: 24px;
        border-radius: 6px;
        background: var(--timer-accent-color, #2196f3);
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(33, 150, 243, 0.3);
        transition: transform 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .timer-position-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
      }
      
      .timer-position-display {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        font-size: 11px;
        font-weight: 600;
        color: var(--timer-active-text, #ffffff);
        padding: 3px 8px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 10;
        pointer-events: none;
        max-width: 50px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      
      .timer-position-labels-container {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-top: 2px;
      }
      
      .timer-position-label {
        font-size: 12px;
        font-weight: 500;
        color: var(--timer-secondary-text, #8e8e93);
        min-width: 30px;
        text-align: center;
      }
      
      .timer-position-label.min-label {
        text-align: left;
      }
      
      .timer-position-label.max-label {
        text-align: right;
      }
      
      /* 搜索框样式 */
      .timer-search-input {
        width: 100%;
        padding: 10px 16px;
        border: 1px solid var(--timer-divider, #c6c6c8);
        border-radius: 10px;
        font-size: 11px;
        color: var(--timer-primary-text, #000000);
        background: var(--timer-input-bg, #ffffff);
        transition: all 0.3s ease;
        font-weight: 400;
        letter-spacing: -0.2px;
      }
      
      .timer-search-input:focus {
        outline: none;
        border-color: var(--timer-accent-color, #007aff);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      }
      
      .timer-search-input::placeholder {
        color: var(--timer-secondary-text, #8e8e93);
        font-weight: 400;
      }
      
      .timer-search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex: 1;
        overflow-y: auto;
        border: 1px solid var(--timer-divider, #c6c6c8);
        border-radius: 10px;
        background: var(--timer-popup-bg, #ffffff);
        padding: 0;
        margin-top: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 1000;
      }
      
      .timer-search-results .timer-entity-item {
        padding: 12px 16px;
        font-size: 16px;
        border-bottom: 1px solid var(--timer-divider, #f0f0f0);
      }
      
      .timer-search-results .timer-entity-item:last-child {
        border-bottom: none;
      }
      
      /* 任务概览样式（单行简洁版） */
      .timer-task-overview {
        padding: 8px 20px;
        background: var(--timer-tab-bg, #f2f2f7);
        border-radius: 8px;
      }
      
      .timer-task-overview-text {
        font-size: 11px;
        color: var(--timer-primary-text, #000000);
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      /* 弹窗底部按钮 */
      .timer-popup-footer {
        display: flex;
        gap: 60px;
        padding: 10px 80px;
        border-radius: 0 0 14px 14px;
      }
      
      .timer-popup-btn {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      
      .timer-popup-btn:first-child {
        background: var(--timer-tab-active-bg, #ffffff);
        color: var(--timer-tab-active-text, #007aff);
        border: 1px solid var(--timer-divider, #c6c6c8);
      }
      
      .timer-popup-btn:first-child:hover {
        background: var(--timer-hover-bg, #f2f2f7);
        transform: translateY(-1px);
      }
      
      .timer-save-btn {
        background: var(--timer-accent-color, #007aff);
        color: white;
      }
      
      .timer-save-btn:hover {
        opacity: 0.85;
        transform: translateY(-1px);
      }
    `;
    
    document.head.appendChild(styleEl);
    this._popupStylesInjected = true;
  }

  // 显示设置弹窗（渲染到 document.body）
  _showSettingsPopup() {
    this._injectPopupStyles();
    
    // 如果已存在弹窗，先移除
    if (this._externalPopup) {
      this._externalPopup.remove();
    }
    
    // 创建弹窗容器
    const overlay = document.createElement('div');
    overlay.className = 'timer-popup-overlay';
    overlay.id = 'timer-settings-popup-overlay';
    
    // 获取当前组件实例的引用
    const self = this;
    
    // 点击遮罩关闭
    overlay.addEventListener('click', () => {
      self.closeSettings();
    });
    
    // 创建弹窗内容
    const popup = document.createElement('div');
    popup.className = 'timer-popup';
    popup.addEventListener('click', (e) => e.stopPropagation());
    
    // 渲染弹窗内容
    popup.innerHTML = this._getSettingsPopupHTML();
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    this._externalPopup = overlay;
    
    // 应用当前主题到弹窗
    this._applyThemeToPopup(popup, this._currentTheme);
    // 设置遮罩背景
    const theme = TimerControlCard.COLOR_SCHEMES[this._currentTheme] || TimerControlCard.COLOR_SCHEMES.light;
    overlay.style.background = theme['--timer-overlay-bg'];
    
    // 绑定事件
    this._bindSettingsPopupEvents();
    
    // 延迟更新温度显示位置（确保DOM渲染完成）
    setTimeout(() => {
      if (this._selectedEntity && this._selectedEntity.startsWith('climate.')) {
        this.updateTemperatureDisplayPosition();
      }
    }, 100);
  }

  // 获取设置弹窗的HTML内容
  _getSettingsPopupHTML() {
    // 解析 _duration 并确保两位数格式
    const parts = (this._duration || '00:30:00').split(':');
    const hours = String(parseInt(parts[0] || '0', 10)).padStart(2, '0');
    const minutes = String(parseInt(parts[1] || '30', 10)).padStart(2, '0');
    const seconds = String(parseInt(parts[2] || '0', 10)).padStart(2, '0');
    const isExpanded = this._deviceSectionExpanded;
    const collapseIcon = isExpanded ? '▼' : '▶';
    
    // 获取分类名称
    const categoryNames = {
      lights: '灯光',
      climate: '气候',
      cover: 'cover',
      fan: '风扇',
      media: '媒体',
      switch: '开关',
      input: '虚拟实体'
    };
    
    // 生成分类标签
    let categoryTabsHTML = '';
    if (this._availableEntities) {
      for (const [category, entities] of Object.entries(this._availableEntities)) {
        if (entities.length === 0) continue;
        const isActive = this._selectedCategory === category ? 'active' : '';
        categoryTabsHTML += `<button class="timer-category-tab ${isActive}" data-category="${category}">${categoryNames[category] || category}</button>`;
      }
    }
    
    // 生成实体列表
    let entityListHTML = '';
    if (this._availableEntities && this._availableEntities[this._selectedCategory]) {
      const entities = this._availableEntities[this._selectedCategory];
      if (entities.length === 0) {
        entityListHTML = `<div style="text-align: center; color: #000000; padding: 20px;">没有找到${categoryNames[this._selectedCategory] || this._selectedCategory}设备</div>`;
      } else {
        entityListHTML = '<div class="timer-entity-list">';
        for (const entity of entities) {
          const isSelected = this._selectedEntity === entity.id ? 'selected' : '';
          entityListHTML += `
            <div class="timer-entity-item ${isSelected}" data-entity-id="${entity.id}">
              <div class="timer-entity-name">${entity.name}</div>
              <div class="timer-entity-id">${entity.id}</div>
            </div>
          `;
        }
        entityListHTML += '</div>';
      }
    }
    
    // 生成搜索结果
    let searchResultsHTML = '';
    if (this._showSearchDropdown && this._searchKeyword && this._searchKeyword.trim() && this._availableEntities) {
      const allEntities = Object.values(this._availableEntities).flat();
      const searchResults = allEntities.filter(entity => 
        entity.name.toLowerCase().includes(this._searchKeyword.toLowerCase()) ||
        entity.id.toLowerCase().includes(this._searchKeyword.toLowerCase())
      );
      
      if (searchResults.length === 0) {
        searchResultsHTML = `<div style="text-align: center; color: #000000; padding: 20px; opacity: 0.7;">未找到匹配的设备</div>`;
      } else {
        searchResultsHTML = '<div class="timer-entity-list">';
        for (const entity of searchResults) {
          const isSelected = this._selectedEntity === entity.id ? 'selected' : '';
          searchResultsHTML += `
            <div class="timer-entity-item ${isSelected}" data-entity-id="${entity.id}">
              <div class="timer-entity-name">${entity.name}</div>
              <div class="timer-entity-id">${entity.id}</div>
            </div>
          `;
        }
        searchResultsHTML += '</div>';
      }
    }
    
    // 空调相关
    const isClimate = this._selectedEntity && this._selectedEntity.startsWith('climate.');
    const isCover = this._selectedEntity && this._selectedEntity.startsWith('cover.');
    
    // 生成动作设置区域
    let actionSectionHTML = '';
    
    if (isClimate) {
      const climateInfo = this.getClimateEntityInfo(this._selectedEntity);
      if (climateInfo) {
        // 初始化空调模式
        if (!this._selectedClimateMode && climateInfo.hvac_modes.length > 0) {
          this._selectedClimateMode = climateInfo.hvac_modes.find(m => m !== 'off') || climateInfo.hvac_modes[0];
        }
        if (!this._selectedTemperature) {
          this._selectedTemperature = Math.round((climateInfo.min_temp + climateInfo.max_temp) / 2);
        }
        
        // 生成模式按钮
        const sortedModes = this.sortClimateModes([...climateInfo.hvac_modes]);
        let modesHTML = '';
        for (const mode of sortedModes) {
          const isActive = this._selectedClimateMode === mode ? 'active' : '';
          const icon = this.getClimateModeIcon(mode);
          modesHTML += `<button class="timer-climate-mode-btn ${isActive}" data-climate-mode="${mode}" title="${this.getClimateModeName(mode)}"><ha-icon icon="${icon}"></ha-icon></button>`;
        }
        
        actionSectionHTML = `
          <div class="timer-climate-action-container">
            <div class="timer-climate-modes-section">
              <div class="timer-climate-modes-title">模式</div>
              <div class="timer-climate-modes">${modesHTML}</div>
            </div>
            <div class="timer-climate-temperature-section">
              <div class="timer-climate-temperature-title">温度</div>
              <div class="timer-slider-wrapper">
                <input type="range" class="timer-temperature-slider" id="temperature-slider" 
                  min="${climateInfo.min_temp}" max="${climateInfo.max_temp}" 
                  step="${climateInfo.target_temp_step}" value="${this._selectedTemperature}">
                <div class="timer-temperature-display" id="temperature-display">${this._selectedTemperature}°C</div>
              </div>
              <div class="timer-temperature-labels-container">
                <span class="timer-temperature-label">${climateInfo.min_temp}°</span>
                <span class="timer-temperature-label">${climateInfo.max_temp}°</span>
              </div>
            </div>
          </div>
        `;
      }
    } else if (isCover) {
      const coverInfo = this.getCoverEntityInfo(this._selectedEntity);
      if (coverInfo) {
        if (!this._coverInitialized && !this._selectedCoverAction) {
          this._selectedCoverAction = 'close';
          this._coverInitialized = true;
        }
        
        actionSectionHTML = `
          <div class="timer-cover-action-container">
            <div class="timer-cover-actions-section">
              <div class="timer-cover-actions-title">动作</div>
              <div class="timer-cover-actions">
                <button class="timer-cover-action-btn ${this._selectedCoverAction === 'close' ? 'active' : ''}" data-cover-action="close" title="关闭窗帘">
                  <ha-icon icon="mdi:curtains-closed"></ha-icon>
                </button>
                <button class="timer-cover-action-btn ${this._selectedCoverAction === 'open' ? 'active' : ''}" data-cover-action="open" title="打开窗帘">
                  <ha-icon icon="mdi:curtains"></ha-icon>
                </button>
                <button class="timer-cover-action-btn ${this._selectedCoverAction === 'set_position' ? 'active' : ''}" data-cover-action="set_position" title="设置位置">
                  <ha-icon icon="mdi:tune"></ha-icon>
                </button>
              </div>
            </div>
            <div class="timer-cover-position-section">
              <div class="timer-cover-position-title">位置</div>
              <div class="timer-slider-wrapper">
                <input type="range" class="timer-position-slider" id="cover-position-slider" 
                  min="0" max="100" step="1" value="${this._selectedCoverPosition}">
                <div class="timer-position-display" id="position-display">${this._selectedCoverPosition}%</div>
              </div>
              <div class="timer-position-labels-container">
                <span class="timer-position-label">关闭</span>
                <span class="timer-position-label">完全打开</span>
              </div>
            </div>
          </div>
        `;
      }
    } else {
      // 普通实体（light, switch, input_boolean等）的动作选择
      // 根据 _selectedAction 决定选中状态
      const entity = this.hass?.states?.[this._selectedEntity];
      const state = entity?.state;
      
      // 如果 _selectedAction 是 'auto'，则根据实体状态决定默认动作
      let currentAction = this._selectedAction;
      if (currentAction === 'auto' || !currentAction) {
        currentAction = state === 'on' ? 'turn_off' : 'turn_on';
      }
      
      actionSectionHTML = `
        <div class="timer-action-options">
          <label class="timer-action-option ${currentAction === 'turn_off' ? 'selected' : ''}">
            <input type="radio" name="action" value="turn_off" ${currentAction === 'turn_off' ? 'checked' : ''}>
            <span class="timer-action-label">关闭</span>
          </label>
          <label class="timer-action-option ${currentAction === 'turn_on' ? 'selected' : ''}">
            <input type="radio" name="action" value="turn_on" ${currentAction === 'turn_on' ? 'checked' : ''}>
            <span class="timer-action-label">开启</span>
          </label>
          <label class="timer-action-option ${currentAction === 'toggle' ? 'selected' : ''}">
            <input type="radio" name="action" value="toggle" ${currentAction === 'toggle' ? 'checked' : ''}>
            <span class="timer-action-label">切换</span>
          </label>
        </div>
      `;
    }
    
    // 生成周期选择按钮
    let recurringOptionsHTML = '';
    if (this._timerMode === 'recurring') {
      // 星期选择
      if (this._recurringInterval === 'weekly') {
        const days = ['一', '二', '三', '四', '五', '六', '日'];
        let daysHTML = '';
        for (let i = 0; i < 7; i++) {
          const isSelected = this._recurringDays.includes(i) ? 'selected' : '';
          daysHTML += `<button class="timer-day-btn ${isSelected}" data-day-index="${i}">${days[i]}</button>`;
        }
        recurringOptionsHTML = `<div class="timer-days-grid">${daysHTML}</div>`;
      }
      
      // 每月日期选择下拉框
      let monthlyDropdownHTML = '';
      if (this._recurringInterval === 'monthly' && this._monthlyDropdownOpen) {
        let daysHTML = '';
        for (let day = 1; day <= 31; day++) {
          const isSelected = this._recurringDays.includes(day) ? 'selected' : '';
          daysHTML += `<button class="timer-monthly-day-btn ${isSelected}" data-month-day="${day}">${day}</button>`;
        }
        daysHTML += `<button class="timer-monthly-day-btn timer-monthly-close-btn" data-action="close-monthly">×</button>`;
        daysHTML += `<button class="timer-monthly-day-btn timer-monthly-confirm-btn" data-action="confirm-monthly">√</button>`;
        monthlyDropdownHTML = `<div class="timer-monthly-grid-dropdown">${daysHTML}</div>`;
      }
      
      // 每月选择显示（在timer-days-grid位置）
      if (this._recurringInterval === 'monthly') {
        if (this._recurringDays.length > 0) {
          // 已选择日期，显示已选日期
          // 每行最多6个，两行最多10个，超过10个显示省略号
          const maxTotal = 10;
          const totalDays = this._recurringDays.length;
          let daysText = '';
          
          if (totalDays > maxTotal) {
            // 超过10个日期，显示前10个 + 省略号
            const displayDays = this._recurringDays.slice(0, maxTotal);
            daysText = displayDays.map(day => `${day}日`).join('、') + '...';
          } else {
            // 10个及以下，显示全部（自动分行）
            daysText = this._recurringDays.map(day => `${day}日`).join('、');
          }
          
          recurringOptionsHTML = `<div class="timer-monthly-selection-display" style="margin-top: 3px; text-align: center; font-size: 11px; color: var(--timer-accent-color, #007aff); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">已选: ${daysText}</div>`;
        } else {
          // 未选择日期，显示提示
          recurringOptionsHTML = `<div class="timer-monthly-selection-display" style="margin-top: 3px; text-align: center; font-size: 11px; color: var(--timer-secondary-text, #8e8e93);">点击"月"选择日期</div>`;
        }
      }
      
      recurringOptionsHTML = `
        <div class="timer-recurring-options">
          <div class="timer-interval-options" style="position: relative;">
            <label class="timer-interval-option">
              <input type="radio" name="interval" value="daily" ${this._recurringInterval === 'daily' ? 'checked' : ''}>
              <span class="timer-interval-label">天</span>
            </label>
            <label class="timer-interval-option">
              <input type="radio" name="interval" value="weekly" ${this._recurringInterval === 'weekly' ? 'checked' : ''}>
              <span class="timer-interval-label">周</span>
            </label>
            <label class="timer-interval-option">
              <input type="radio" name="interval" value="monthly" ${this._recurringInterval === 'monthly' ? 'checked' : ''}>
              <span class="timer-interval-label">月</span>
            </label>
            ${monthlyDropdownHTML}
          </div>
          ${recurringOptionsHTML}
        </div>
      `;
    }
    
    // 快速选择按钮
    let quickDurationsHTML = '';
    if (this._timerMode !== 'recurring') {
      if (this._timerMode === 'countdown') {
        quickDurationsHTML = `
          <div class="timer-quick-durations">
            <button class="timer-quick-btn" data-duration="5">5分钟</button>
            <button class="timer-quick-btn" data-duration="10">10分钟</button>
            <button class="timer-quick-btn" data-duration="30">30分钟</button>
            <button class="timer-quick-btn" data-duration="60">1小时</button>
            <button class="timer-quick-btn" data-duration="120">2小时</button>
            <button class="timer-quick-btn" data-duration="360">6小时</button>
          </div>
        `;
      } else {
        quickDurationsHTML = `
          <div class="timer-quick-durations">
            <button class="timer-quick-btn" data-duration="08:00:00">08:00</button>
            <button class="timer-quick-btn" data-duration="12:00:00">12:00</button>
            <button class="timer-quick-btn" data-duration="14:00:00">14:00</button>
            <button class="timer-quick-btn" data-duration="16:00:00">16:00</button>
            <button class="timer-quick-btn" data-duration="20:00:00">20:00</button>
            <button class="timer-quick-btn" data-duration="23:00:00">23:00</button>
          </div>
        `;
      }
    }
    
    return `
      <div class="timer-popup-header">
        <div class="timer-popup-title">添加定时器</div>
        <button class="timer-popup-close" data-action="close-settings">×</button>
      </div>
      
      <!-- 设备选择 -->
      <div class="timer-device-selection-section">
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 10px;" data-action="toggle-device-section">
          <div class="timer-device-section-title">${collapseIcon} 选择设备</div>
          ${isExpanded ? `
            <div style="position: relative;">
              <input type="text" class="timer-search-input" placeholder="搜索实体..." style="width: 200px;" value="${this._searchKeyword || ''}" data-action="search-entities">
              ${this._searchKeyword ? `<button style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #666; font-size: 16px;" data-action="clear-search">×</button>` : ''}
              ${this._showSearchDropdown && this._searchKeyword ? `<div class="timer-search-results">${searchResultsHTML}</div>` : ''}
            </div>
          ` : ''}
        </div>
        
        ${isExpanded ? `
          <!-- 分类标签 -->
          <div class="timer-category-tabs">${categoryTabsHTML}</div>
          
          <!-- 实体列表 -->
          <div class="timer-entity-categories">${entityListHTML}</div>
        ` : ''}
      </div>
      
      <!-- 定时时长设置 -->
      <div class="timer-duration-section">
        <div class="timer-section-header">
          <div class="timer-duration-section-title">定时时长</div>
          <div class="timer-mode-buttons">
            <button class="timer-mode-btn ${this._timerMode === 'countdown' ? 'active' : ''}" data-mode="countdown">倒计时</button>
            <button class="timer-mode-btn ${this._timerMode === 'absolute_time' ? 'active' : ''}" data-mode="absolute_time">指定时间</button>
            <button class="timer-mode-btn ${this._timerMode === 'recurring' ? 'active' : ''}" data-mode="recurring">周期定时</button>
          </div>
        </div>
        <div class="timer-duration-container">
          <!-- 时间输入 -->
          <div class="timer-time-inputs">
            <div class="timer-flip-clock-input" data-type="hours">
              <div class="timer-flip-clock-card">
                <div class="timer-flip-clock-face front">${hours}</div>
                <div class="timer-flip-clock-face back">${hours}</div>
              </div>
              <div class="timer-flip-clock-top" data-action="increment" data-unit="hours"></div>
              <div class="timer-flip-clock-bottom" data-action="decrement" data-unit="hours"></div>
            </div>
            <div class="timer-colon-separator">:</div>
            <div class="timer-flip-clock-input" data-type="minutes">
              <div class="timer-flip-clock-card">
                <div class="timer-flip-clock-face front">${minutes}</div>
                <div class="timer-flip-clock-face back">${minutes}</div>
              </div>
              <div class="timer-flip-clock-top" data-action="increment" data-unit="minutes"></div>
              <div class="timer-flip-clock-bottom" data-action="decrement" data-unit="minutes"></div>
            </div>
            <div class="timer-colon-separator">:</div>
            <div class="timer-flip-clock-input" data-type="seconds">
              <div class="timer-flip-clock-card">
                <div class="timer-flip-clock-face front">${seconds}</div>
                <div class="timer-flip-clock-face back">${seconds}</div>
              </div>
              <div class="timer-flip-clock-top" data-action="increment" data-unit="seconds"></div>
              <div class="timer-flip-clock-bottom" data-action="decrement" data-unit="seconds"></div>
            </div>
          </div>
          
          ${recurringOptionsHTML}
          ${quickDurationsHTML}
        </div>
      </div>
      
      <!-- 动作设置 -->
      <div class="timer-action-section">
        <div class="timer-action-section-title">定时动作</div>
        ${actionSectionHTML}
      </div>
      
      <!-- 任务概览 -->
      ${this._generateTaskOverviewHTML()}
      
      <!-- 按钮区域 -->
      <div class="timer-popup-footer">
        <button class="timer-popup-btn" data-action="cancel">取消</button>
        <button class="timer-popup-btn timer-save-btn" data-action="save">确定</button>
      </div>
    `;
  }

  // 生成任务概览HTML（单行简洁显示）
  _generateTaskOverviewHTML() {
    // 获取选中实体的友好名称
    let entityName = '未选择设备';
    let entityDomain = '';
    if (this._selectedEntity) {
      const entity = this.hass?.states?.[this._selectedEntity];
      entityName = entity?.attributes?.friendly_name || this._selectedEntity;
      entityDomain = this._selectedEntity.split('.')[0];
    }
    
    // 获取定时模式名称
    const timerModeNames = {
      'countdown': '倒计时',
      'recurring': '周期任务',
      'absolute_time': '指定时间'
    };
    const timerModeName = timerModeNames[this._timerMode] || '倒计时';
    
    // 获取动作名称
    let actionName = '切换';
    if (entityDomain === 'climate') {
      actionName = this.getClimateModeName(this._selectedClimateMode) || '自动';
      if (this._selectedClimateMode !== 'off') {
        actionName += ` ${this._selectedTemperature}°C`;
      }
    } else if (entityDomain === 'cover') {
      const coverActionNames = {
        'open': '打开',
        'close': '关闭',
        'set_position': `设置位置 ${this._selectedCoverPosition}%`
      };
      actionName = coverActionNames[this._selectedCoverAction] || '关闭';
    } else {
      // 普通实体（light, switch, input_boolean等）：使用用户选择的动作
      const actionNames = {
        'turn_on': '开启',
        'turn_off': '关闭',
        'toggle': '切换'
      };
      // 如果用户已选择动作，使用选择的动作名称
      if (this._selectedAction && this._selectedAction !== 'auto') {
        actionName = actionNames[this._selectedAction] || '切换';
      } else {
        // 如果是 'auto' 或未设置，根据实体状态显示
        const entity = this.hass?.states?.[this._selectedEntity];
        const state = entity?.state;
        if (state === 'on') {
          actionName = '关闭';
        } else if (state === 'off') {
          actionName = '开启';
        }
      }
    }
    
    // 获取时间显示
    const timeDisplay = this._duration || '00:30:00';
    
    // 获取周期任务详情
    let recurringDetail = '';
    if (this._timerMode === 'recurring') {
      const intervalNames = {
        'daily': '每天',
        'weekly': '每周',
        'monthly': '每月'
      };
      recurringDetail = intervalNames[this._recurringInterval] || '每天';
      
      if (this._recurringInterval === 'weekly' && this._recurringDays.length > 0) {
        const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
        const selectedDays = this._recurringDays.map(i => dayNames[i]).join('');
        recurringDetail = `周${selectedDays}`;
      } else if (this._recurringInterval === 'monthly' && this._recurringDays.length > 0) {
        const selectedDays = this._recurringDays.slice(0, 3).join('、') + (this._recurringDays.length > 3 ? '...' : '');
        recurringDetail = `每月${selectedDays}日`;
      }
    }
    
    // 构建单行概览文本
    let overviewText = `${entityName} · ${timerModeName}`;
    if (recurringDetail) {
      overviewText += `(${recurringDetail})`;
    }
    overviewText += ` · ${timeDisplay} · ${actionName}`;
    
    return `
      <div class="timer-task-overview">
        <div class="timer-task-overview-text">${overviewText}</div>
      </div>
    `;
  }

  // 绑定设置弹窗的事件
  _bindSettingsPopupEvents() {
    if (!this._externalPopup) return;
    
    const self = this;
    const popup = this._externalPopup.querySelector('.timer-popup');
    if (!popup) return;
    
    // 关闭弹窗
    popup.querySelector('[data-action="close-settings"]')?.addEventListener('click', () => {
      self.closeSettings();
    });
    
    popup.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      self.closeSettings();
    });
    
    // 保存设置
    popup.querySelector('[data-action="save"]')?.addEventListener('click', () => {
      self.saveSettings();
    });
    
    // 切换设备区域展开状态
    popup.querySelector('[data-action="toggle-device-section"]')?.addEventListener('click', () => {
      self._deviceSectionExpanded = !self._deviceSectionExpanded;
      self._refreshSettingsPopup();
    });
    
    // 搜索实体 - 使用实时更新下拉框，不重新渲染整个弹窗
    const searchInput = popup.querySelector('[data-action="search-entities"]');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        self._searchKeyword = e.target.value;
        self._showSearchDropdown = true;
        // 只更新搜索下拉框，不刷新整个弹窗
        self._updateSearchDropdown(popup);
      });
      searchInput.addEventListener('focus', () => {
        self._showSearchDropdown = true;
        // 只更新搜索下拉框
        self._updateSearchDropdown(popup);
      });
      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          self._showSearchDropdown = false;
          // 隐藏下拉框
          self._updateSearchDropdown(popup);
        }, 200);
      });
      // 阻止点击搜索框时触发折叠/展开
      searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // 清除搜索按钮
    const clearSearchBtn = popup.querySelector('[data-action="clear-search"]');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        self._searchKeyword = '';
        self._showSearchDropdown = false;
        // 更新输入框值和下拉框
        const input = popup.querySelector('[data-action="search-entities"]');
        if (input) input.value = '';
        self._updateSearchDropdown(popup);
        // 需要刷新以移除清除按钮
        self._refreshSettingsPopup();
      });
    }
    
    // 分类切换
    popup.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', () => {
        self._selectedCategory = btn.dataset.category;
        self._refreshSettingsPopup();
      });
    });
    
    // 实体选择
    popup.querySelectorAll('[data-entity-id]').forEach(item => {
      item.addEventListener('click', () => {
        self.selectEntityFromSearch(item.dataset.entityId);
        self._refreshSettingsPopup();
      });
    });
    
    // 模式切换
    popup.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        self._timerMode = btn.dataset.mode;
        self._refreshSettingsPopup();
      });
    });
    
    // 时间增减
    popup.querySelectorAll('[data-action="increment"]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.incrementDuration(btn.dataset.unit);
        self._refreshSettingsPopup();
      });
    });
    
    popup.querySelectorAll('[data-action="decrement"]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.decrementDuration(btn.dataset.unit);
        self._refreshSettingsPopup();
      });
    });
    
    // 快速选择
    popup.querySelectorAll('[data-duration]').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.duration;
        if (self._timerMode === 'countdown') {
          const mins = parseInt(value);
          const hrs = Math.floor(mins / 60);
          const m = mins % 60;
          self._duration = `${String(hrs).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        } else {
          self._duration = value;
        }
        self._refreshSettingsPopup();
      });
    });
    
    // 动作选择（普通实体：light, switch, input_boolean等）
    popup.querySelectorAll('input[name="action"]').forEach(radio => {
      radio.addEventListener('change', () => {
        self._selectedAction = radio.value;
        // 只更新任务概览，不刷新整个弹窗
        self._updateTaskOverview(popup);
      });
    });
    
    // 周期选择
    popup.querySelectorAll('input[name="interval"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const value = radio.value;
        // 如果选择月周期，打开下拉框
        if (value === 'monthly') {
          self._monthlyDropdownOpen = true;
        } else {
          self._monthlyDropdownOpen = false;
        }
        self.setRecurringInterval(value);
        self._refreshSettingsPopup();
      });
    });
    
    // 点击月标签也能打开下拉框
    popup.querySelectorAll('.timer-interval-option').forEach(label => {
      const radio = label.querySelector('input[name="interval"]');
      const span = label.querySelector('.timer-interval-label');
      if (radio && span && radio.value === 'monthly') {
        span.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          // 切换下拉框状态
          if (self._recurringInterval === 'monthly') {
            self._monthlyDropdownOpen = !self._monthlyDropdownOpen;
          } else {
            self._recurringInterval = 'monthly';
            self._monthlyDropdownOpen = true;
          }
          self._refreshSettingsPopup();
        });
      }
    });
    
    // 星期选择
    popup.querySelectorAll('[data-day-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.dayIndex);
        self.toggleRecurringDay(index);
        self._refreshSettingsPopup();
      });
    });
    
    // 每月日期选择
    popup.querySelectorAll('[data-month-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.dataset.monthDay);
        const idx = self._recurringDays.indexOf(day);
        if (idx > -1) {
          self._recurringDays.splice(idx, 1);
        } else {
          self._recurringDays.push(day);
        }
        self._recurringDays.sort((a, b) => a - b);
        if (self._recurringDays.length > 0) {
          self._selectedMonthlyDay = self._recurringDays[0];
        } else {
          self._selectedMonthlyDay = null;
        }
        self._refreshSettingsPopup();
      });
    });
    
    // 关闭/确认每月下拉框
    popup.querySelector('[data-action="close-monthly"]')?.addEventListener('click', () => {
      self._monthlyDropdownOpen = false;
      self._refreshSettingsPopup();
    });
    
    popup.querySelector('[data-action="confirm-monthly"]')?.addEventListener('click', () => {
      self._monthlyDropdownOpen = false;
      self._refreshSettingsPopup();
    });
    
    // 空调模式选择
    popup.querySelectorAll('[data-climate-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        self._selectedClimateMode = btn.dataset.climateMode;
        self._refreshSettingsPopup();
      });
    });
    
    // 温度滑块
    const tempSlider = popup.querySelector('#temperature-slider');
    if (tempSlider) {
      tempSlider.addEventListener('input', (e) => {
        self._selectedTemperature = parseFloat(e.target.value);
        const display = popup.querySelector('#temperature-display');
        if (display) {
          display.textContent = `${self._selectedTemperature}°C`;
        }
        // 更新温度显示位置（跟随滑块移动）
        self.updateTemperatureDisplayPosition();
      });
    }
    
    // 窗帘动作选择
    popup.querySelectorAll('[data-cover-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        self._selectedCoverAction = btn.dataset.coverAction;
        self._refreshSettingsPopup();
      });
    });
    
    // 窗帘位置滑块
    const posSlider = popup.querySelector('#cover-position-slider');
    if (posSlider) {
      posSlider.addEventListener('input', (e) => {
        self._selectedCoverPosition = parseInt(e.target.value);
        const display = popup.querySelector('#position-display');
        if (display) {
          display.textContent = `${self._selectedCoverPosition}%`;
        }
        // 更新百分比显示位置
        self.updateCoverDisplayPosition();
      });
    }
  }

  // 更新搜索下拉框（不重新渲染整个弹窗）
  _updateSearchDropdown(popup) {
    if (!popup) return;

    // 查找搜索结果容器
    const searchContainer = popup.querySelector('.timer-search-input')?.parentElement;
    if (!searchContainer) return;

    // 移除旧的搜索结果
    const oldResults = searchContainer.querySelector('.timer-search-results');
    if (oldResults) {
      oldResults.remove();
    }

    // 如果需要显示搜索结果
    if (this._showSearchDropdown && this._searchKeyword && this._searchKeyword.trim() && this._availableEntities) {
      const allEntities = Object.values(this._availableEntities).flat();
      const searchResults = allEntities.filter(entity =>
        entity.name.toLowerCase().includes(this._searchKeyword.toLowerCase()) ||
        entity.id.toLowerCase().includes(this._searchKeyword.toLowerCase())
      );

      let searchResultsHTML = '';
      if (searchResults.length === 0) {
        searchResultsHTML = `<div style="text-align: center; color: #000000; padding: 20px; opacity: 0.7;">未找到匹配的设备</div>`;
      } else {
        searchResultsHTML = '<div class="timer-entity-list">';
        for (const entity of searchResults) {
          const isSelected = this._selectedEntity === entity.id ? 'selected' : '';
          searchResultsHTML += `
            <div class="timer-entity-item ${isSelected}" data-entity-id="${entity.id}">
              <div class="timer-entity-name">${entity.name}</div>
              <div class="timer-entity-id">${entity.id}</div>
            </div>
          `;
        }
        searchResultsHTML += '</div>';
      }

      // 创建并插入新的搜索结果
      const resultsDiv = document.createElement('div');
      resultsDiv.className = 'timer-search-results';
      resultsDiv.innerHTML = searchResultsHTML;
      searchContainer.appendChild(resultsDiv);

      // 绑定搜索结果点击事件
      resultsDiv.querySelectorAll('[data-entity-id]').forEach(item => {
        item.addEventListener('mousedown', (e) => {
          // 使用 mousedown 而不是 click，避免 blur 事件先触发
          e.preventDefault();
          this.selectEntityFromSearch(item.dataset.entityId);
          this._refreshSettingsPopup();
        });
      });
    }

    // 更新清除按钮
    const oldClearBtn = searchContainer.querySelector('[data-action="clear-search"]');
    if (oldClearBtn) {
      oldClearBtn.remove();
    }

    // 如果有搜索关键词，添加清除按钮
    if (this._searchKeyword) {
      const clearBtn = document.createElement('button');
      clearBtn.style.cssText = 'position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #666; font-size: 16px;';
      clearBtn.setAttribute('data-action', 'clear-search');
      clearBtn.textContent = '×';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._searchKeyword = '';
        this._showSearchDropdown = false;
        const input = popup.querySelector('[data-action="search-entities"]');
        if (input) input.value = '';
        this._updateSearchDropdown(popup);
        this._refreshSettingsPopup();
      });
      searchContainer.appendChild(clearBtn);
    }
  }

  // 只更新任务概览（不刷新整个弹窗）
  _updateTaskOverview(popup) {
    if (!popup) {
      popup = this._externalPopup?.querySelector('.timer-popup');
    }
    if (!popup) return;
    
    const overviewElement = popup.querySelector('.timer-task-overview');
    if (overviewElement) {
      overviewElement.outerHTML = this._generateTaskOverviewHTML();
    }
  }

  // 刷新设置弹窗
  _refreshSettingsPopup() {
    if (!this._externalPopup) return;
    
    const popup = this._externalPopup.querySelector('.timer-popup');
    if (!popup) return;
    
    popup.innerHTML = this._getSettingsPopupHTML();
    this._bindSettingsPopupEvents();
    
    // 延迟更新温度显示位置和滚动到选中实体（确保DOM渲染完成）
    setTimeout(() => {
      if (this._selectedEntity && this._selectedEntity.startsWith('climate.')) {
        this.updateTemperatureDisplayPosition();
      } else if (this._selectedEntity && this._selectedEntity.startsWith('cover.')) {
        this.updateCoverDisplayPosition();
      }
      // 滚动到选中的实体
      this.scrollToSelectedEntity();
    }, 50);
  }

  // 移除设置弹窗
  _removeSettingsPopup() {
    if (this._externalPopup) {
      this._externalPopup.remove();
      this._externalPopup = null;
    }
  }

  // 显示任务列表弹窗（渲染到 document.body）
  _showTaskListPopup() {
    this._injectPopupStyles();
    
    // 重置历史记录状态，默认显示任务列表
    this._showHistory = false;
    this._historyFilter = 'all';  // 重置历史筛选条件
    
    // 如果已存在弹窗，先移除
    if (this._externalTaskListPopup) {
      this._externalTaskListPopup.remove();
    }
    
    // 创建弹窗容器
    const overlay = document.createElement('div');
    overlay.className = 'timer-popup-overlay';
    overlay.id = 'timer-task-list-popup-overlay';
    
    // 获取当前组件实例的引用
    const self = this;
    
    // 点击遮罩关闭
    overlay.addEventListener('click', () => {
      self.closeTaskList();
    });
    
    // 创建弹窗内容
    const popup = document.createElement('div');
    popup.className = `timer-task-list-popup ${this._activeTimersList.length > 0 ? 'has-tasks' : ''}`;
    popup.addEventListener('click', (e) => e.stopPropagation());
    
    // 渲染弹窗内容
    popup.innerHTML = this._getTaskListPopupHTML();
    
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    
    this._externalTaskListPopup = overlay;
    
    // 应用当前主题到弹窗
    this._applyThemeToPopup(popup, this._currentTheme);
    // 设置遮罩背景
    const theme = TimerControlCard.COLOR_SCHEMES[this._currentTheme] || TimerControlCard.COLOR_SCHEMES.light;
    overlay.style.background = theme['--timer-overlay-bg'];
    
    // 绑定事件
    this._bindTaskListPopupEvents();
  }

  // 获取任务列表弹窗的HTML内容
  _getTaskListPopupHTML() {
    let contentHTML = '';
    
    if (this._activeTimersList.length > 0) {
      let rowsHTML = '';
      
      for (let index = 0; index < this._activeTimersList.length; index++) {
        const timer = this._activeTimersList[index];
        
        if (timer.is_schedule) {
          // 周期任务
          const scheduleInfo = timer.repeat_type === 'weekly' && timer.weekdays ? 
            `周${this.getWeekdaysText(timer.weekdays)}` : 
            timer.repeat_type === 'monthly' && timer.month_days ? 
            `${this.getMonthDaysText(timer.month_days)}` : 
            this.getRepeatTypeText(timer.repeat_type);
          
          const nextExec = timer.next_execution ? 
            `下次 ${new Date(timer.next_execution).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })} ${new Date(timer.next_execution).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '';
          
          rowsHTML += `
            <tr style="background: rgba(0, 122, 255, 0.05);">
              <td style="text-align: center; color: #007aff; font-weight: 500;">${index + 1}</td>
              <td>
                <div class="timer-entity-info">
                  <div class="timer-entity-name">${this.getEntityFriendlyName(timer.entity_id)}</div>
                  <div class="timer-entity-id">${timer.entity_id}</div>
                </div>
              </td>
              <td style="text-align: center;">
                <div class="timer-time-display" data-schedule-countdown="${timer.schedule_id}" style="font-size: 12px; color: #007aff; font-weight: 500;">
                  ${this.formatTaskTime(timer.schedule_countdown || 0)}${this.getTaskActionDisplayText(timer)}
                </div>
                <div style="font-size: 10px; color: #8e8e93; margin-top: 2px;">
                  ${scheduleInfo} ${timer.schedule_time}
                </div>
                ${nextExec ? `<div style="font-size: 9px; color: #007aff; margin-top: 1px;">${nextExec}</div>` : ''}
              </td>
              <td>
                <div class="timer-task-actions" style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                  <button class="timer-task-cancel-btn" data-schedule-id="${timer.schedule_id}" style="width: 50px; padding: 4px 8px;">取消</button>
                </div>
              </td>
            </tr>
          `;
        } else {
          // 普通定时器
          const remainingSeconds = this.getTaskRemainingSeconds(timer);
          const endTimeText = timer.end_time ? this.formatEndTime(timer.end_time) : '';
          
          rowsHTML += `
            <tr>
              <td style="text-align: center; color: #8e8e93; font-weight: 500;">${index + 1}</td>
              <td>
                <div class="timer-entity-info">
                  <div class="timer-entity-name">${this.getEntityFriendlyName(timer.entity_id)}</div>
                  <div class="timer-entity-id">${timer.entity_id}</div>
                </div>
              </td>
              <td style="text-align: center;">
                <div class="timer-time-display" data-countdown-entity="${timer.entity_id}">${this.formatTime(remainingSeconds)}${this.getTaskActionDisplayText(timer)}</div>
                ${endTimeText ? `<div class="timer-end-time" data-endtime-entity="${timer.entity_id}" style="font-size: 10px; color: #8e8e93; margin-top: 2px;">${endTimeText}</div>` : ''}
              </td>
              <td>
                <div class="timer-task-actions" style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                  <button class="timer-task-cancel-btn" data-entity-id="${timer.entity_id}" style="width: 50px; padding: 4px 8px;">取消</button>
                  <button class="timer-task-modify-btn" data-timer-index="${index}" style="width: 50px; padding: 4px 8px;">修改</button>
                </div>
              </td>
            </tr>
          `;
        }
      }
      
      contentHTML = `
        <table class="timer-task-table">
          <thead>
            <tr>
              <th style="width: 60px;">序号</th>
              <th>设备名</th>
              <th style="width: 180px;">倒计时/周期</th>
              <th style="width: 80px; text-align: center;">操作</th>
            </tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      `;
    } else {
      contentHTML = `
        <div class="timer-empty-state">
          <div class="timer-empty-state-icon">⏰</div>
          <div class="timer-empty-state-title">暂无任务</div>
          <div class="timer-empty-state-subtitle">当前没有正在执行的定时任务</div>
        </div>
      `;
    }
    
    // 获取历史记录内容
    const historyHTML = this._showHistory ? this._getHistoryListHTML() : '';
    
    // 历史记录筛选按钮HTML
    const historyFilterHTML = this._showHistory ? `
      <div class="timer-history-filter" style="display: flex; justify-content: center; align-items: center; gap: 8px; padding: 12px;">
        <button class="timer-filter-btn ${this._historyFilter === 'all' ? 'active' : ''}" data-filter="all" style="padding: 4px 12px; font-size: 11px; border: 1px solid var(--timer-divider, #f0f0f0); border-radius: 6px; cursor: pointer; background: ${this._historyFilter === 'all' ? 'var(--timer-accent-color, #007aff)' : 'var(--timer-button-bg, rgba(0, 0, 0, 0.05))'}; color: ${this._historyFilter === 'all' ? '#ffffff' : 'var(--timer-primary-text, #000000)'};">全部</button>
        <button class="timer-filter-btn ${this._historyFilter === 'success' ? 'active' : ''}" data-filter="success" style="padding: 4px 12px; font-size: 11px; border: 1px solid var(--timer-divider, #f0f0f0); border-radius: 6px; cursor: pointer; background: ${this._historyFilter === 'success' ? 'var(--timer-success-color, #28a745)' : 'var(--timer-button-bg, rgba(0, 0, 0, 0.05))'}; color: ${this._historyFilter === 'success' ? '#ffffff' : 'var(--timer-primary-text, #000000)'};">成功</button>
        <button class="timer-filter-btn ${this._historyFilter === 'failed' ? 'active' : ''}" data-filter="failed" style="padding: 4px 12px; font-size: 11px; border: 1px solid var(--timer-divider, #f0f0f0); border-radius: 6px; cursor: pointer; background: ${this._historyFilter === 'failed' ? 'var(--timer-danger-color, #ff3b30)' : 'var(--timer-button-bg, rgba(0, 0, 0, 0.05))'}; color: ${this._historyFilter === 'failed' ? '#ffffff' : 'var(--timer-primary-text, #000000)'};">失败</button>
        <button class="timer-filter-btn ${this._historyFilter === 'cancelled' ? 'active' : ''}" data-filter="cancelled" style="padding: 4px 12px; font-size: 11px; border: 1px solid var(--timer-divider, #f0f0f0); border-radius: 6px; cursor: pointer; background: ${this._historyFilter === 'cancelled' ? 'var(--timer-warning-color, #ff9500)' : 'var(--timer-button-bg, rgba(0, 0, 0, 0.05))'}; color: ${this._historyFilter === 'cancelled' ? '#ffffff' : 'var(--timer-primary-text, #000000)'};">取消</button>
        <button class="timer-filter-btn ${this._historyFilter === 'unknown' ? 'active' : ''}" data-filter="unknown" style="padding: 4px 12px; font-size: 11px; border: 1px solid var(--timer-divider, #f0f0f0); border-radius: 6px; cursor: pointer; background: ${this._historyFilter === 'unknown' ? 'var(--timer-secondary-text, #8e8e93)' : 'var(--timer-button-bg, rgba(0, 0, 0, 0.05))'}; color: ${this._historyFilter === 'unknown' ? '#ffffff' : 'var(--timer-primary-text, #000000)'};">未知</button>
        <button class="timer-clear-history-btn" data-action="clear-history" style="padding: 4px 12px; font-size: 11px; border: 1px solid var(--timer-danger-color, #ff3b30); border-radius: 6px; cursor: pointer; background: transparent; color: var(--timer-danger-color, #ff3b30);">清除</button>
      </div>
    ` : '';
    
    return `
      <div class="timer-task-list-header">
        <div class="timer-task-list-title">${this._showHistory ? '历史记录' : '任务中心'}</div>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${this._showHistory ? `
            <button class="timer-task-history-btn" data-action="show-tasks" style="padding: 4px 6px; font-size: 11px; background: var(--timer-accent-color, #007aff); color: #ffffff; border: none; border-radius: 6px; cursor: pointer;">
              返回任务
            </button>
          ` : `
            <div style="font-size: 11px; color: ${this._activeTimersCount > 0 ? '#ffffff' : '#8e8e93'}; background: ${this._activeTimersCount > 0 ? '#ee5a52' : '#f2f2f7'}; padding: 4px 6px; border-radius: 8px; font-weight: 500;">
              总任务: ${this._activeTimersCount}
            </div>
            <button class="timer-task-history-btn" data-action="show-history" style="padding: 4px 6px; font-size: 11px; background: var(--timer-button-bg, rgba(0, 0, 0, 0.05)); color: var(--timer-primary-text, #000000); border: 1px solid var(--timer-divider, #f0f0f0); border-radius: 6px; cursor: pointer;">
              历史
            </button>
            <button class="timer-task-modify-btn" data-action="add-timer" style="padding: 4px 6px; font-size: 11px;">新增</button>
            ${this._activeTimersCount > 0 ? `<button class="timer-task-cancel-all-btn" data-action="cancel-all" style="padding: 4px 6px; font-size: 11px;">全部取消</button>` : ''}
          `}
          <button class="timer-task-list-close" data-action="close-task-list">×</button>
        </div>
      </div>
      ${historyFilterHTML}
      <div class="timer-task-list-content">${this._showHistory ? historyHTML : contentHTML}</div>
    `;
  }


  // 获取历史记录列表的HTML内容
  _getHistoryListHTML() {
    const historyEntityId = 'sensor.timer_active_tasks';
    const historyEntity = this.hass?.states?.[historyEntityId];
    
    if (!historyEntity) {
      return `
        <div class="timer-empty-state">
          <div class="timer-empty-state-icon">📋</div>
          <div class="timer-empty-state-title">无法加载历史记录</div>
          <div class="timer-empty-state-subtitle">请检查传感器实体是否存在</div>
        </div>
      `;
    }
    
    // 从 all_task_list 中获取所有任务
    const allTaskList = historyEntity.attributes?.all_task_list || [];
    
    // 获取任务的结果类型（用于筛选）
    const getTaskResultType = (task) => {
      // 优先检查执行结果字段
      if (task.execution_result) {
        return task.execution_result;
      }

      // 检查任务状态
      if (task.status === 'cancelled') {
        // 对于已取消的任务，检查是否有执行记录
        // last_executed 有值说明曾经成功执行过
        if (task.last_executed) {
          return 'success';
        }
        return 'cancelled';
      }

      if (task.status === 'completed') {
        return 'success';
      }

      if (task.status === 'failed') {
        return 'failed';
      }

      // 其他情况：检查是否有执行记录
      if (task.last_executed || task.executed_at) {
        return 'success';
      }

      return 'unknown';
    };
    
    // 根据筛选条件过滤任务
    let filteredList = allTaskList.filter(task => {
      const resultType = getTaskResultType(task);
      // 只显示已完成、失败、取消的任务
      if (!['success', 'failed', 'cancelled', 'unknown'].includes(resultType)) {
        return false;
      }
      // 根据当前筛选条件过滤
      if (this._historyFilter === 'all') return true;
      return resultType === this._historyFilter;
    });
    
    if (filteredList.length === 0) {
      const filterText = {
        'all': '',
        'success': '成功',
        'failed': '失败',
        'cancelled': '取消',
        'unknown': '未知'
      };
      return `
        <div class="timer-empty-state">
          <div class="timer-empty-state-icon">📋</div>
          <div class="timer-empty-state-title">暂无${filterText[this._historyFilter]}记录</div>
          <div class="timer-empty-state-subtitle">${this._historyFilter === 'all' ? '还没有执行过的定时任务' : '没有符合条件的记录'}</div>
        </div>
      `;
    }
    
    let rowsHTML = '';
    
    // 按日期倒序排列（最新的在前面）
    const sortedList = [...filteredList].reverse();
    
    sortedList.forEach((task, index) => {
      const resultType = getTaskResultType(task);
      
      // 根据结果类型设置样式
      let resultClass, resultText, resultIcon;
      if (resultType === 'success') {
        resultClass = 'history-success';
        resultText = '成功';
        resultIcon = '✓';
      } else if (resultType === 'failed') {
        resultClass = 'history-failed';
        resultText = '失败';
        resultIcon = '✗';
      } else if (resultType === 'cancelled') {
        resultClass = 'history-cancelled';
        resultText = '取消';
        resultIcon = '⊘';
      } else {
        resultClass = 'history-unknown';
        resultText = '未知';
        resultIcon = '?';
      }
      
      // 格式化时间（优先使用 day/start_time，fallback 到 created_at/executed_at/cancelled_at）
      const day = task.day || 
                  (task.created_at ? task.created_at.split('T')[0] : '') ||
                  (task.cancelled_at ? task.cancelled_at.split('T')[0] : '');
      const startTime = task.start_time ? this.formatHistoryDateTime(task.start_time) : 
                         task.executed_at ? this.formatHistoryDateTime(task.executed_at) :
                         task.cancelled_at ? this.formatHistoryDateTime(task.cancelled_at) :
                         (task.created_at ? this.formatHistoryDateTime(task.created_at) : '');
      
      // 状态变化
      const beforeState = task.before_entity_state || '-';
      const afterState = task.after_entity_state || '-';
      
      // 格式化任务操作显示：去掉"布尔值"后缀
      const actionText = (task.task_action || '-')
        .replace('打开布尔值', '打开')
        .replace('关闭布尔值', '关闭');
      
      // 获取任务类型显示
      const taskType = task.task_type || (task.is_recurring ? '周期任务' : '一次性任务');
      const taskTypeClass = task.is_recurring ? 'timer-type-recurring' : 'timer-type-onetime';
      
      rowsHTML += `
        <tr class="timer-history-row ${resultClass}">
          <td style="text-align: center; font-weight: 500; color: #007aff">${index + 1}</td>
          <td>
            <div class="timer-entity-info">
              <div class="timer-entity-name">${task.entity_name || task.entity_id || '-'}</div>
              <div class="timer-entity-id">${task.entity_id || '-'}</div>
            </div>
          </td>
          <td style="text-align: center;">
            <span class="${taskTypeClass}" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: ${task.is_recurring ? 'rgba(255, 149, 0, 0.15)' : 'rgba(52, 152, 219, 0.15)'}; color: ${task.is_recurring ? '#ff9500' : '#3498db'};">${taskType}</span>
          </td>
          <td style="text-align: center;">
            <div style="font-size: 11px; font-weight: 500; color: #007aff">${day}</div>
            <div style="font-size: 10px; color: var(--timer-secondary-text, #8e8e93); margin-top: 2px;">${startTime}</div>
          </td>
          <td style="text-align: center;">
            <div class="timer-history-action">${actionText}</div>
            <div style="font-size: 9px; color: var(--timer-secondary-text, #8e8e93); margin-top: 2px;">
              ${beforeState} → ${afterState}
            </div>
          </td>
          <td style="text-align: center;">
            <span class="timer-history-result ${resultClass}" title="${resultText}">
              ${resultIcon}
            </span>
          </td>
        </tr>
      `;
    });
    
    return `
      <table class="timer-task-table timer-history-table">
        <thead>
          <tr>
            <th style="width: 50px;">序号</th>
            <th>设备名</th>
            <th style="width: 70px;">类型</th>
            <th style="width: 100px;">日期/时间</th>
            <th style="width: 100px;">操作</th>
            <th style="width: 60px;">结果</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    `;
  }

  // 格式化历史记录的日期时间
  formatHistoryDateTime(dateTimeStr) {
    if (!dateTimeStr) return '-';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return dateTimeStr;
    }
  }

  // 绑定任务列表弹窗的事件
  _bindTaskListPopupEvents() {
    if (!this._externalTaskListPopup) return;
    
    const self = this;
    const popup = this._externalTaskListPopup.querySelector('.timer-task-list-popup');
    if (!popup) return;
    
    // 关闭弹窗
    popup.querySelector('[data-action="close-task-list"]')?.addEventListener('click', () => {
      self.closeTaskList();
    });
    
    // 显示历史记录
    popup.querySelector('[data-action="show-history"]')?.addEventListener('click', () => {
      self._showHistory = true;
      self._refreshTaskListPopup();
    });
    
    // 返回任务列表
    popup.querySelector('[data-action="show-tasks"]')?.addEventListener('click', () => {
      self._showHistory = false;
      self._refreshTaskListPopup();
    });
    
    // 新增定时器
    popup.querySelector('[data-action="add-timer"]')?.addEventListener('click', () => {
      self.closeTaskList();
      self.openAddTimer();
    });
    
    // 全部取消
    popup.querySelector('[data-action="cancel-all"]')?.addEventListener('click', () => {
      self.cancelAllTimers();
    });
    
    // 取消特定定时器
    popup.querySelectorAll('[data-entity-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.cancelSpecificTimer(btn.dataset.entityId);
      });
    });
    
    // 取消特定周期任务
    popup.querySelectorAll('[data-schedule-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.cancelSpecificSchedule(btn.dataset.scheduleId);
      });
    });
    
    // 修改定时器
    popup.querySelectorAll('[data-timer-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.timerIndex);
        const timer = self._activeTimersList[index];
        if (timer) {
          self.modifySpecificTimer(timer);
          // 关闭任务列表弹窗并打开设置弹窗
          self._removeTaskListPopup();
          self._showSettingsPopup();
        }
      });
    });
    
    // 历史记录筛选按钮
    popup.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        self._historyFilter = btn.dataset.filter;
        self._refreshTaskListPopup();
      });
    });
    
    // 清除历史记录按钮
    popup.querySelector('[data-action="clear-history"]')?.addEventListener('click', () => {
      if (confirm('确定要清除所有历史记录吗？此操作不可恢复。')) {
        self.clearAllHistory();
      }
    });
  }


  // 刷新任务列表弹窗
  _refreshTaskListPopup() {
    if (!this._externalTaskListPopup) return;
    
    const popup = this._externalTaskListPopup.querySelector('.timer-task-list-popup');
    if (!popup) return;
    
    popup.innerHTML = this._getTaskListPopupHTML();
    this._bindTaskListPopupEvents();
  }

  // 更新外部任务列表弹窗中的倒计时显示（不重新渲染整个弹窗）
  _updateTaskListPopupCountdown() {
    if (!this._externalTaskListPopup || !this._activeTimersList || this._showHistory) return;
    
    const popup = this._externalTaskListPopup.querySelector('.timer-task-list-popup');
    if (!popup) return;
    
    // 遍历所有任务，更新倒计时显示
    this._activeTimersList.forEach(timer => {
      if (!timer.is_schedule) {
        // 更新普通定时器倒计时显示
        const countdownEl = popup.querySelector(`[data-countdown-entity="${timer.entity_id}"]`);
        if (countdownEl) {
          const remainingSeconds = this.getTaskRemainingSeconds(timer);
          countdownEl.textContent = this.formatTime(remainingSeconds) + this.getTaskActionDisplayText(timer);
        }
      } else {
        // 更新周期任务倒计时显示
        const scheduleCountdownEl = popup.querySelector(`[data-schedule-countdown="${timer.schedule_id}"]`);
        if (scheduleCountdownEl) {
          const countdown = this.calculateScheduleCountdown(timer);
          scheduleCountdownEl.textContent = this.formatTaskTime(countdown) + this.getTaskActionDisplayText(timer);
        }
      }
    });
  }

  // 移除任务列表弹窗
  _removeTaskListPopup() {
    if (this._externalTaskListPopup) {
      this._externalTaskListPopup.remove();
      this._externalTaskListPopup = null;
    }
  }

  // 移除所有外部弹窗
  _removeExternalPopups() {
    this._removeSettingsPopup();
    this._removeTaskListPopup();
  }

  // 【已删除】renderTaskList() 方法
  // 原方法将任务列表弹窗渲染到 Shadow DOM，现在改为渲染到 document.body
  // 使用 _showTaskListPopup() 和 _getTaskListPopupHTML() 替代

  async cancelSpecificTimer(entityId) {
    try {
      if (!this._hassReady) {
        console.error('Hass未就绪，无法取消定时器');
        return;
      }
      
      await this.sendEventSafe({
        action: 'cancel_entity_timer',
        entity_id: entityId,
        user_id: 'user'
      });

      // 【优化】移除立即刷新，等待后端事件响应后再更新
      // 避免短时间内发送大量同步请求导致消息堆积

    } catch (error) {
      console.error('取消特定定时器失败:', error);
    }
  }

  async cancelAllTimers() {
    try {
      if (!this._hassReady) {
        console.error('Hass未就绪，无法取消定时器');
        return;
      }

      if ((!this._activeTimersList || this._activeTimersList.length === 0) &&
          (!this._activeSchedulesList || this._activeSchedulesList.length === 0)) {
        return;
      }

      // 保存需要取消的任务列表（复制一份，防止在循环过程中被修改）
      const timersToCancel = [...(this._activeTimersList || [])];
      const schedulesToCancel = [...(this._activeSchedulesList || [])];

      // 逐个取消定时器，间隔0.5秒
      for (let i = 0; i < timersToCancel.length; i++) {
        const timer = timersToCancel[i];
        try {
          await this.sendEventSafe({
            action: 'cancel_entity_timer',
            entity_id: timer.entity_id,
            user_id: 'user'
          });

          // 如果不是最后一个，等待0.5秒
          if (i < timersToCancel.length - 1 || schedulesToCancel.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          console.error('发送取消定时器事件失败:', timer.entity_id, error);
        }
      }

      // 逐个取消周期任务，间隔0.5秒
      for (let i = 0; i < schedulesToCancel.length; i++) {
        const schedule = schedulesToCancel[i];
        try {
          await this.sendEventSafe({
            action: 'cancel_schedule',
            schedule_id: schedule.schedule_id,
            user_id: 'user'
          });

          // 如果不是最后一个，等待0.5秒
          if (i < schedulesToCancel.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          console.error('发送取消周期任务事件失败:', schedule.schedule_id, error);
        }
      }

      // 不要立即清除本地状态，等待后端响应后自动更新
      // 等待后端处理完成（等待2秒，让后端处理完所有取消操作）
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 刷新定时器列表，获取最新状态
      await this.refreshTimersWithRetry();

      // 现在可以安全地关闭弹窗
      this.closeTaskList();

    } catch (error) {
      console.error('取消全部定时器失败:', error);
      // 即使出错也要关闭弹窗
      this.closeTaskList();
    }
  }

  modifySpecificTimer(timer) {
    // 设置当前选中的实体
    this._selectedEntity = timer.entity_id;
    
    // 如果定时器有持续时间，设置到duration
    if (timer.duration) {
      this._duration = timer.duration;
    }
    
    // 如果定时器有剩余时间，将其设置为当前时长
    if (timer.remaining_seconds && timer.remaining_seconds > 0) {
      const remainingSeconds = Math.floor(timer.remaining_seconds);
      this._duration = this.secondsToDuration(remainingSeconds);
    }
    
    // 关闭任务清单弹窗，打开设置界面弹窗
    this._showTaskList = false;
    this._showSettings = true;
    
    // 关闭任务列表弹窗
    this._removeTaskListPopup();
    
    // 打开设置弹窗
    this._showSettingsPopup();
  }

  updateDuration(type, value) {
    const numValue = parseInt(value) || 0;
    
    const parts = this._duration.split(':');
    let hours = parseInt(parts[0]) || 0;
    let minutes = parseInt(parts[1]) || 30;
    let seconds = parseInt(parts[2]) || 0;
    
    if (type === 'hours') hours = Math.min(23, numValue);
    if (type === 'minutes') minutes = Math.min(59, numValue);
    if (type === 'seconds') seconds = Math.min(59, numValue);
    
    this._duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  setQuickDuration(value) {
    if (this._timerMode === 'countdown') {
      // 倒计时模式：value是分钟数
      const hours = Math.floor(value / 60);
      const mins = value % 60;
      this._duration = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
    } else {
      // 指定时间模式：value是时间字符串（如"08:00:00"）
      this._duration = value;
    }
    this.requestUpdate();
  }

  // 选择分类
  selectCategory(category) {
    this._selectedCategory = category;
    this.requestUpdate();
  }

  // 设置计时模式
  setTimerMode(mode) {
    this._timerMode = mode;
    this.requestUpdate();
  }

  // 设置周期定时间隔
  setRecurringInterval(interval) {
    this._recurringInterval = interval;
    // 如果是每周模式，默认选择所有日期
    if (interval === 'weekly' && this._recurringDays.length === 0) {
      this._recurringDays = [0, 1, 2, 3, 4, 5, 6];
    }
    // 如果是每月模式，初始化选中日期
    if (interval === 'monthly') {
      if (this._recurringDays.length === 0) {
        this._recurringDays = [1]; // 默认选择1号
        this._selectedMonthlyDay = 1;
      }
    } else {
      // 切换到其他模式时关闭下拉框
      this._monthlyDropdownOpen = false;
    }
    this.requestUpdate();
  }

  // 切换周期定时的日期选择
  toggleRecurringDay(dayIndex) {
    const index = this._recurringDays.indexOf(dayIndex);
    if (index > -1) {
      this._recurringDays.splice(index, 1);
    } else {
      this._recurringDays.push(dayIndex);
    }
    this.requestUpdate();
  }

  // 切换每月下拉框的显示状态
  toggleMonthlyDropdown() {
    this._monthlyDropdownOpen = !this._monthlyDropdownOpen;
    if (this._monthlyDropdownOpen) {
      // 延迟执行定位，确保DOM已更新
      setTimeout(() => {
        this.positionMonthlyDropdown();
      }, 10);
    }
    this.requestUpdate();
  }

  // 定位每月下拉框，使其直接放在interval-options元素下方并左对齐
  positionMonthlyDropdown() {
    // 现在下拉框已经直接放在interval-options容器内，不需要特殊定位
    // 因为interval-options已经设置了position: relative和overflow: visible
    // 下拉框的CSS样式已经设置了正确的位置（top: 100%, left: 0）
    
    // 确保下拉框可见
    const dropdown = this.shadowRoot?.querySelector('.monthly-grid-dropdown');
    if (dropdown) {
      dropdown.style.display = 'grid';
      dropdown.style.visibility = 'visible';
      dropdown.style.opacity = '1';
    }
  }

  // 切换每月日期的多选状态
  toggleMonthlyDay(day) {
    const index = this._recurringDays.indexOf(day);
    if (index > -1) {
      this._recurringDays.splice(index, 1);
    } else {
      this._recurringDays.push(day);
    }
    // 排序日期
    this._recurringDays.sort((a, b) => a - b);
    // 更新选中的日期（用于显示第一个选中的日期）
    if (this._recurringDays.length > 0) {
      this._selectedMonthlyDay = this._recurringDays[0];
    } else {
      this._selectedMonthlyDay = null;
    }
    // 阻止事件冒泡，防止下拉框立即关闭
    event.stopPropagation();
    event.preventDefault();
    this.requestUpdate();
  }

  // 解析绝对时间
  parseAbsoluteTime(timeString) {
    try {
      const parts = timeString.split(':');
      if (parts.length !== 3) return null;
      
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;
      
      // 验证时间范围
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
        return null;
      }
      
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, seconds, 0);
      
      // 如果设置的时间已经过去，则设置为明天的同一时间
      if (targetTime.getTime() <= now.getTime()) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      return targetTime;
    } catch (error) {
      console.error('解析绝对时间失败:', error);
      return null;
    }
  }

  // 将秒数转换为 HH:MM:SS 格式
  secondsToDuration(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // 搜索实体
  searchEntities(keyword) {
    this._searchKeyword = keyword;
    this.requestUpdate();
  }

  // 从搜索结果选择实体
  selectEntityFromSearch(entityId) {
    // 找到实体对应的分类
    for (const [category, entities] of Object.entries(this._availableEntities)) {
      if (entities.some(entity => entity.id === entityId)) {
        this._selectedCategory = category;
        break;
      }
    }

    this._selectedEntity = entityId;
    this._searchKeyword = ''; // 清空搜索框
    this._showSearchDropdown = false; // 关闭下拉框
    this._selectedAction = 'auto'; // 重置动作选择为自动

    // 如果是空调实体，初始化空调状态
    if (entityId && entityId.startsWith('climate.')) {
      const climateInfo = this.getClimateEntityInfo(entityId);
      if (climateInfo) {
        this._selectedClimateMode = climateInfo.hvac_modes.find(m => m !== 'off') || climateInfo.hvac_modes[0];
        this._selectedTemperature = Math.round((climateInfo.min_temp + climateInfo.max_temp) / 2);
      }
    } else if (entityId && entityId.startsWith('cover.')) {
      // 如果是窗帘实体，初始化窗帘状态
      const coverInfo = this.getCoverEntityInfo(entityId);
      if (coverInfo) {
        this._selectedCoverAction = 'close'; // 默认关闭动作
        this._selectedCoverPosition = (coverInfo.current_position !== undefined && coverInfo.current_position !== null) ? coverInfo.current_position : 50;
      } else {
        this._selectedCoverAction = 'close';
        this._selectedCoverPosition = 50;
      }
    }
    
    this.requestUpdate();
    
    // 注意：滚动和显示更新由 _refreshSettingsPopup 处理，这里不再重复调用
    
    // 立即刷新该实体的定时器状态（仅在有活跃任务时触发）
    if (this._hassReady && this._hasActiveTasks()) {
      this.refreshTimersWithRetry();
    }
  }

  // 滚动到选中的实体
  scrollToSelectedEntity() {
    if (!this.shadowRoot) return;
    
    const selectedElement = this.shadowRoot.querySelector('.entity-item.selected');
    if (selectedElement) {
      const container = this.shadowRoot.querySelector('.entity-categories');
      if (container) {
        // 使用更可靠的滚动方法
        const elementRect = selectedElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // 检查元素是否已经在可视区域内
        const isElementVisible = 
          elementRect.top >= containerRect.top && 
          elementRect.bottom <= containerRect.bottom;
        
        if (!isElementVisible) {
          // 如果元素不在可视区域内，滚动到元素
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }
    }
  }

  // 选择实体
  selectEntity(entityId) {
    this._selectedEntity = entityId;

    // 如果是空调实体，初始化空调状态
    if (entityId && entityId.startsWith('climate.')) {
      const climateInfo = this.getClimateEntityInfo(entityId);
      if (climateInfo) {
        this._selectedClimateMode = climateInfo.hvac_modes.find(m => m !== 'off') || climateInfo.hvac_modes[0];
        this._selectedTemperature = Math.round((climateInfo.min_temp + climateInfo.max_temp) / 2);
      }
    } else if (entityId && entityId.startsWith('cover.')) {
      // 如果是窗帘实体，初始化窗帘状态
      const coverInfo = this.getCoverEntityInfo(entityId);
      if (coverInfo) {
        this._selectedCoverAction = 'close'; // 默认关闭动作
        this._selectedCoverPosition = (coverInfo.current_position !== undefined && coverInfo.current_position !== null) ? coverInfo.current_position : 50;
      } else {
        this._selectedCoverAction = 'close';
        this._selectedCoverPosition = 50;
      }
    }
    
    this.requestUpdate();
    
    // 延迟执行温度显示更新，确保DOM已更新
    setTimeout(() => {
      if (entityId && entityId.startsWith('climate.')) {
        this.updateTemperatureDisplayPosition();
      } else if (entityId && entityId.startsWith('cover.')) {
        this.updateCoverDisplayPosition();
      }
    }, 100);
    
    // 立即刷新该实体的定时器状态（仅在有活跃任务时触发）
    if (this._hassReady && this._hasActiveTasks()) {
      this.refreshTimersWithRetry();
    }
  }

  // 取消特定定时器
  async cancelSpecificTimer(entityId) {
    try {
      if (!this._hassReady) {
        this._debugInfo = 'Hass未就绪，请稍后重试';
        return;
      }
      
      await this.sendEventSafe({
        action: 'cancel_entity_timer',
        entity_id: entityId,
        user_id: 'user'
      });
      
      // 刷新状态（弹窗刷新会在 handleResponse 中处理）
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 500);
      
    } catch (error) {
      this._debugInfo = `取消定时器失败: ${error.message}`;
    }
  }

  // 修改特定定时器
  async modifySpecificTimer(timer) {
    try {
      if (!this._hassReady) {
        this._debugInfo = 'Hass未就绪，请稍后重试';
        return;
      }
      
      // 设置当前选中的实体为要修改的定时器实体
      this._selectedEntity = timer.entity_id;

      // 如果是空调实体，初始化空调状态
      if (this._selectedEntity && this._selectedEntity.startsWith('climate.')) {
        const climateInfo = this.getClimateEntityInfo(this._selectedEntity);
        if (climateInfo) {
          this._selectedClimateMode = climateInfo.hvac_modes.find(m => m !== 'off') || climateInfo.hvac_modes[0];
          this._selectedTemperature = Math.round((climateInfo.min_temp + climateInfo.max_temp) / 2);
        }
      } else if (this._selectedEntity && this._selectedEntity.startsWith('cover.')) {
        // 如果是窗帘实体，初始化窗帘状态
        const coverInfo = this.getCoverEntityInfo(this._selectedEntity);
        if (coverInfo) {
          this._selectedCoverAction = 'close'; // 默认关闭动作
          this._selectedCoverPosition = (coverInfo.current_position !== undefined && coverInfo.current_position !== null) ? coverInfo.current_position : 50;
        } else {
          this._selectedCoverAction = 'close';
          this._selectedCoverPosition = 50;
        }
      }

      // 如果定时器有剩余时间，将其设置为当前时长
      if (timer.remaining_seconds && timer.remaining_seconds > 0) {
        // 确保只处理整数秒数，去掉小数部分
        const remainingSeconds = Math.floor(timer.remaining_seconds);
        this._duration = this.secondsToDuration(remainingSeconds);
      }

      // 打开设置界面
      this._showSettings = true;
      this.requestUpdate();

      // 延迟更新显示位置
      setTimeout(() => {
        if (this._selectedEntity && this._selectedEntity.startsWith('cover.')) {
          this.updateCoverDisplayPosition();
        }
      }, 100);

      // 显示修改提示
      this._debugInfo = `正在修改 ${timer.entity_id} 的定时器`;
      
    } catch (error) {
      this._debugInfo = `修改定时器失败: ${error.message}`;
    }
  }

  async saveSettings() {
    try {
      if (!this._hassReady) {
        this._debugInfo = 'Hass未就绪，请稍后重试';
        return;
      }

      if (!this._selectedEntity) {
        this._debugInfo = '请先选择设备';
        return;
      }

      // 【关键修复】点击确定时，从翻页钟DOM获取当前显示的时间
      // 这样可以确保获取的是用户最终看到和选择的时间
      if (this.config.show_debug) {
        console.log('[saveSettings] 开始从翻页钟DOM获取时间...');
        console.log('[saveSettings] _externalPopup:', this._externalPopup ? '存在' : '不存在');
      }

      if (this._externalPopup) {
        const popup = this._externalPopup.querySelector('.timer-popup');
        if (this.config.show_debug) {
          console.log('[saveSettings] popup元素:', popup ? '找到' : '未找到');
        }

        if (popup) {
          const hoursEl = popup.querySelector('.timer-flip-clock-input[data-type="hours"] .timer-flip-clock-face.front');
          const minutesEl = popup.querySelector('.timer-flip-clock-input[data-type="minutes"] .timer-flip-clock-face.front');
          const secondsEl = popup.querySelector('.timer-flip-clock-input[data-type="seconds"] .timer-flip-clock-face.front');

          if (this.config.show_debug) {
            console.log('[saveSettings] 翻页钟元素状态:', {
              hoursEl: hoursEl ? `找到, 内容="${hoursEl.textContent}"` : '未找到',
              minutesEl: minutesEl ? `找到, 内容="${minutesEl.textContent}"` : '未找到',
              secondsEl: secondsEl ? `找到, 内容="${secondsEl.textContent}"` : '未找到'
            });
          }

          if (hoursEl && minutesEl && secondsEl) {
            const hours = hoursEl.textContent.trim() || '00';
            const minutes = minutesEl.textContent.trim() || '30';
            const seconds = secondsEl.textContent.trim() || '00';
            // 更新 _duration 为从DOM获取的值
            this._duration = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
            if (this.config.show_debug) {
              console.log('[saveSettings] 从DOM获取时间成功:', this._duration);
            }
          } else if (this.config.show_debug) {
            console.warn('[saveSettings] 翻页钟元素未完全找到，使用当前_duration:', this._duration);
          }
        } else if (this.config.show_debug) {
          console.warn('[saveSettings] 未找到.popup元素');
        }
      } else if (this.config.show_debug) {
        console.warn('[saveSettings] _externalPopup不存在');
      }
      if (this.config.show_debug) {
        console.log('[saveSettings] 最终_duration值:', this._duration);
      }

      // 检查是否正在修改现有定时器
      const isModifying = this._activeTimersList.some(timer => timer.entity_id === this._selectedEntity);

      if (isModifying) {
        // 修改现有定时器 - 先取消再重新创建
        await this.sendEventSafe({
          action: 'cancel_entity_timer',
          entity_id: this._selectedEntity,
          user_id: 'user'
        });

        // 等待一小段时间确保取消完成
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 创建新的定时器（或重新创建修改后的定时器）
      let totalSeconds;
      let durationToSend;

      // 生成正确的 action_type 和 action_data
      let actionType;
      let actionData = {};

      if (this._selectedEntity && this._selectedEntity.startsWith('climate.')) {
        // 空调实体：使用选择的模式和温度
        actionType = this._selectedClimateMode || 'cool';
      } else if (this._selectedEntity && this._selectedEntity.startsWith('cover.')) {
        // 窗帘实体：使用选择的动作和位置
        const coverAction = this._selectedCoverAction || 'close';
        const coverPosition = this._selectedCoverPosition || 50;
        actionType = coverAction;
        if (coverAction === 'set_position') {
          actionData = { position: coverPosition };
        }
      } else {
        // 普通实体（light, switch, input_boolean等）：使用用户选择的动作
        if (this._selectedAction && this._selectedAction !== 'auto') {
          actionType = this._selectedAction;
        } else {
          // 如果是 'auto' 或未设置，根据实体状态决定
          actionType = this.getConcreteActionType(this._selectedEntity);
        }
      }

      if (this._timerMode === 'recurring') {
        // 周期定时模式：创建周期任务
        // 调试日志（仅当 show_debug 为 true 时输出）
        if (this.config.show_debug) {
          console.log('[saveSettings] 创建周期任务, _duration:', this._duration);
        }

        // 确保 schedule_time 格式为 HH:MM:SS
        const durationParts = (this._duration || '00:30:00').split(':');
        if (this.config.show_debug) {
          console.log('[saveSettings] durationParts:', durationParts);
        }

        const scheduleTime = `${String(parseInt(durationParts[0] || '0', 10)).padStart(2, '0')}:${String(parseInt(durationParts[1] || '30', 10)).padStart(2, '0')}:${String(parseInt(durationParts[2] || '0', 10)).padStart(2, '0')}`;
        if (this.config.show_debug) {
          console.log('[saveSettings] scheduleTime:', scheduleTime);
        }
        
        const scheduleData = {
          action: 'create_schedule',
          entity_id: this._selectedEntity,
          repeat_type: this._recurringInterval,
          schedule_time: scheduleTime,  // 使用格式化后的时间
          action_type: actionType,
          user_id: 'user'
        };

        if (Object.keys(actionData).length > 0) {
          scheduleData.action_data = actionData;
        }

        // 根据周期类型添加额外参数
        if (this._recurringInterval === 'weekly') {
          // 将索引转换为星期字符串，过滤掉无效索引
          const weekdayMap = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          scheduleData.weekdays = this._recurringDays
            .filter(dayIndex => dayIndex >= 0 && dayIndex < 7)
            .map(dayIndex => weekdayMap[dayIndex])
            .filter(day => day != null);
        } else if (this._recurringInterval === 'monthly') {
          // 过滤掉无效日期
          scheduleData.month_days = this._recurringDays
            .filter(day => day != null && day >= 1 && day <= 31);
        }

        // 调试日志（仅当 show_debug 为 true 时输出）
        if (this.config.show_debug) {
          console.log('[saveSettings] 发送周期任务数据:', JSON.stringify(scheduleData, null, 2));
        }

        await this.sendEventSafe(scheduleData);
      } else if (this._timerMode === 'absolute_time') {
        const targetTime = this.parseAbsoluteTime(this._duration);
        if (targetTime) {
          const now = new Date();
          totalSeconds = Math.max(0, Math.floor((targetTime.getTime() - now.getTime()) / 1000));
          durationToSend = this.secondsToDuration(totalSeconds);
        } else {
          totalSeconds = this.durationToSeconds(this._duration);
          durationToSend = this._duration;
        }

        const timerData = {
          action: 'create_timer',
          entity_id: this._selectedEntity,
          duration: durationToSend,
          action_type: actionType,
          user_id: 'user'
        };

        if (Object.keys(actionData).length > 0) {
          timerData.action_data = actionData;
        }

        // 如果是空调实体，添加空调动作参数
        if (this._selectedEntity && this._selectedEntity.startsWith('climate.')) {
          timerData.climate_mode = this._selectedClimateMode;
          timerData.temperature = this._selectedTemperature;
        }

        await this.sendEventSafe(timerData);
      } else {
        // 倒计时模式
        totalSeconds = this.durationToSeconds(this._duration);
        durationToSend = this._duration;

        const timerData = {
          action: 'create_timer',
          entity_id: this._selectedEntity,
          duration: durationToSend,
          action_type: actionType,
          user_id: 'user'
        };

        if (Object.keys(actionData).length > 0) {
          timerData.action_data = actionData;
        }

        // 如果是空调实体，添加空调动作参数
        if (this._selectedEntity && this._selectedEntity.startsWith('climate.')) {
          timerData.climate_mode = this._selectedClimateMode;
          timerData.temperature = this._selectedTemperature;
        }

        await this.sendEventSafe(timerData);
      }

      this._showSettings = false;
      this._totalSeconds = totalSeconds;
      
      // 关闭外部弹窗
      this._removeSettingsPopup();

      // 刷新状态
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 1000);

      this.requestUpdate();

    } catch (error) {
      console.error('saveSettings error:', error);
      this._debugInfo = `保存设置失败: ${error.message}`;
    }
  }


  // 实时计算任务的剩余时间（避免时间跳动）
  getTaskRemainingSeconds(task) {
    if (!task) return 0;
    
    // 优先使用 end_time 计算准确剩余时间
    if (task.end_time) {
      const now = Date.now();
      const endTime = new Date(task.end_time).getTime();
      const remainingMs = Math.max(0, endTime - now);
      return Math.floor(remainingMs / 1000);
    }
    
    // 没有end_time时使用remaining_seconds
    return Math.max(0, Math.floor(task.remaining_seconds || 0));
  }

  formatTime(seconds) {
    // 确保只处理整数秒数，去掉小数部分
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  durationToSeconds(duration) {
    const [hours, minutes, seconds] = duration.split(':').map(Number);
    return (hours * 3600) + (minutes * 60) + seconds;
  }

  // 将秒数转换为 HH:MM:SS 格式
  secondsToDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // 解析绝对时间格式（HH:MM:SS）
  parseAbsoluteTime(timeString) {
    try {
      const [hours, minutes, seconds] = timeString.split(':').map(Number);
      const now = new Date();
      const targetTime = new Date(now);
      targetTime.setHours(hours, minutes, seconds, 0);
      
      // 如果目标时间已经过去，设置为明天的同一时间
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      return targetTime;
    } catch (error) {
      console.error('解析绝对时间失败:', error);
      return null;
    }
  }

  // 增加时间单位
  async incrementDuration(type) {
    // 先更新数值
    const [hours, minutes, seconds] = this._duration.split(':').map(Number);
    
    switch (type) {
      case 'hours':
        const newHours = (hours + 1) % 24;
        this._duration = `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        break;
      case 'minutes':
        const newMinutes = (minutes + 1) % 60;
        this._duration = `${String(hours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        break;
      case 'seconds':
        const newSeconds = (seconds + 1) % 60;
        this._duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`;
        break;
    }
    
    // 立即更新UI
    this.requestUpdate();
    
    // 添加翻页动画 - 优先从外部弹窗查找
    let card = null;
    if (this._externalPopup) {
      card = this._externalPopup.querySelector(`.timer-flip-clock-input[data-type="${type}"] .timer-flip-clock-card`);
    }
    if (!card && this.shadowRoot) {
      card = this.shadowRoot.querySelector(`.flip-clock-input[data-type="${type}"] .flip-clock-card`);
    }
    if (card) {
      card.classList.add('flipping');
      
      // 等待动画完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 移除动画类
      card.classList.remove('flipping');
    }
  }

  // 减少时间单位
  async decrementDuration(type) {
    // 先更新数值
    const [hours, minutes, seconds] = this._duration.split(':').map(Number);
    
    switch (type) {
      case 'hours':
        const newHours = hours > 0 ? hours - 1 : 23;
        this._duration = `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        break;
      case 'minutes':
        const newMinutes = minutes > 0 ? minutes - 1 : 59;
        this._duration = `${String(hours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        break;
      case 'seconds':
        const newSeconds = seconds > 0 ? seconds - 1 : 59;
        this._duration = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`;
        break;
    }
    
    // 立即更新UI
    this.requestUpdate();
    
    // 添加翻页动画 - 优先从外部弹窗查找
    let card = null;
    if (this._externalPopup) {
      card = this._externalPopup.querySelector(`.timer-flip-clock-input[data-type="${type}"] .timer-flip-clock-card`);
    }
    if (!card && this.shadowRoot) {
      card = this.shadowRoot.querySelector(`.flip-clock-input[data-type="${type}"] .flip-clock-card`);
    }
    if (card) {
      card.classList.add('flipping');
      
      // 等待动画完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 移除动画类
      card.classList.remove('flipping');
    }
  }

  getCardSize() {
    return 1;
  }

  // 处理时间变化
  handleTimeChange(type, value) {
    const numValue = parseInt(value) || 0;
    if (type === 'hours') {
      this._selectedHours = numValue;
    } else if (type === 'minutes') {
      this._selectedMinutes = numValue;
    }
    this.requestUpdate();
  }

  // 确认时间选择
  async confirmTimePicker() {
    // 更新 duration
    this._duration = `${String(this._selectedHours).padStart(2, '0')}:${String(this._selectedMinutes).padStart(2, '0')}:00`;

    // 更新配置中的 default_duration，以便下次使用
    this.config.default_duration = this._duration;
    this._pickerDefaultDuration = this._duration;

    // 如果有选中的实体，立即启动定时器
    if (this._selectedEntity && this._hassReady) {
      // 计算总秒数
      const totalSeconds = this._selectedHours * 3600 + this._selectedMinutes * 60;
      this._totalSeconds = totalSeconds;
      this._remainingSeconds = totalSeconds;
      this._progress = 100;

      // 根据实体类型设置默认的 action_type
      let actionType = this.getConcreteActionType(this._selectedEntity);
      let actionData = {};

      if (this._selectedEntity && this._selectedEntity.startsWith('cover.')) {
        // 窗帘实体：使用用户选择的动作
        const coverAction = this._selectedCoverAction || 'close';
        const coverPosition = this._selectedCoverPosition || 50;

        actionType = coverAction;
        if (coverAction === 'set_position') {
          actionData = { position: coverPosition };
        }
      }

      try {
        const eventData = {
          action: 'create_timer',
          entity_id: this._selectedEntity,
          duration: this._duration,
          action_type: actionType,
          user_id: 'user'
        };

        if (Object.keys(actionData).length > 0) {
          eventData.action_data = actionData;
        }

        await this.sendEventSafe(eventData);

        // 创建临时定时器信息
        this._timerInfo = {
          entity_id: this._selectedEntity,
          duration: this._duration,
          action: '定时器运行中',
          remaining_seconds: this._remainingSeconds,
          end_time: new Date(Date.now() + this._totalSeconds * 1000).toISOString()
        };

        // 刷新状态
        setTimeout(() => {
          this.refreshTimersWithRetry();
        }, 1000);
      } catch (error) {
        console.error('启动定时器失败:', error);
      }
    }

    this.requestUpdate();
  }

  // 取消周期任务
  async cancelSpecificSchedule(scheduleId) {
    try {
      if (!this._hassReady) {
        console.error('Hass未就绪，无法取消周期任务');
        return;
      }

      await this.sendEventSafe({
        action: 'cancel_schedule',
        schedule_id: scheduleId,
        user_id: 'user'
      });

      // 刷新状态（弹窗刷新会在 handleResponse 中处理）
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 500);

    } catch (error) {
      console.error('取消周期任务失败:', error);
    }
  }

  // 获取周期类型文本
  getRepeatTypeText(repeatType) {
    const typeMap = {
      'daily': '每天',
      'weekly': '每周',
      'monthly': '每月'
    };
    return typeMap[repeatType] || repeatType;
  }

  // 获取星期文本
  getWeekdaysText(weekdays) {
    if (!weekdays || !Array.isArray(weekdays)) return '';
    const weekdayMap = {
      'monday': '一',
      'tuesday': '二',
      'wednesday': '三',
      'thursday': '四',
      'friday': '五',
      'saturday': '六',
      'sunday': '日',
      'mon': '一',
      'tue': '二',
      'wed': '三',
      'thu': '四',
      'fri': '五',
      'sat': '六',
      'sun': '日'
    };
    // 过滤掉 null/undefined 值，避免 toLowerCase() 报错
    return weekdays
      .filter(day => day != null)
      .map(day => weekdayMap[day.toLowerCase()] || day)
      .join('、');
  }

  // 获取月日文本
  getMonthDaysText(monthDays) {
    if (!monthDays || !Array.isArray(monthDays)) return '';
    // 过滤掉 null/undefined 值
    return monthDays
      .filter(day => day != null)
      .map(day => `${day}日`)
      .join('、');
  }

  // 获取实体友好名称
  getEntityFriendlyName(entityId) {
    if (!this.hass || !this.hass.states || !entityId) {
      return entityId;
    }
    const entity = this.hass.states[entityId];
    return entity?.attributes?.friendly_name || entityId;
  }

  // 格式化结束时间
  formatEndTime(endTime) {
    try {
      const date = new Date(endTime);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return '';
    }
  }

  // ========================================
  // 主题系统方法
  // ========================================

  /**
   * 从配置初始化主题
   */
  _initThemeFromConfig() {
    if (!this._themeConfig) return;
    
    // 停止之前的定时器和监听器
    this._toggleThemeListener(false);
    
    // 调用 _updateTheme（如果 _hass 未准备好且是实体配置，会自动跳过）
    this._updateTheme();
  }

  /**
   * 初始化主题
   */
  _initTheme() {
    if (!this._themeConfig) return;
    
    this._updateTheme();
  }

  /**
   * 更新主题配置（主入口）
   */
  _updateTheme() {
    const theme = this._themeConfig;
    
    // 没有配置且已有主题时保持当前主题（避免闪烁）
    if (theme === undefined && this._lastThemeName) return;
    
    // 检查是否是实体配置，如果是实体配置且 _hass 还未准备好，则延迟处理
    let isEntityConfig = false;
    if (typeof theme === 'object' && theme !== null && theme.entity) {
      isEntityConfig = true;
    } else if (typeof theme === 'string' && theme.includes('.')) {
      isEntityConfig = true;
    }
    
    // 如果是实体配置但 _hass 还未准备好，跳过本次更新（等待 set hass 时处理）
    if (isEntityConfig && !this.hass) {
      return;
    }
    
    // 停止所有监听器
    this._toggleThemeListener(false);
    
    let themeName = 'light'; // 默认主题
    let needsListener = false;
    
    if (theme !== undefined && theme !== null) {
      // 处理特殊模式
      const specialMode = this._handleSpecialThemeMode(theme);
      if (specialMode) {
        themeName = specialMode.themeName;
        needsListener = specialMode.needsListener;
      } else {
        themeName = this._determineTheme(theme);
      }
      
      this._lastThemeName = themeName;
    }
    
    // 启用监听器（如果需要）
    if (needsListener) {
      this._toggleThemeListener(true);
    }
    
    // 应用主题
    this._applyThemeInternal(themeName);
  }

  /**
   * 根据实体状态实时更新主题
   */
  _updateThemeFromEntity() {
    if (!this._themeConfig || !this.hass) return;

    const theme = this._themeConfig;
    let entityState, isSelectEntity;

    // 对象格式的实体配置
    if (typeof theme === 'object' && theme !== null && theme.entity && this.hass.states[theme.entity]) {
      const themeEntity = this.hass.states[theme.entity];
      entityState = themeEntity.state;
      isSelectEntity = theme.entity.toLowerCase().includes('select');
    }
    // 字符串格式的实体ID（向后兼容）
    else if (typeof theme === 'string' && theme.includes('.') && this.hass.states[theme]) {
      const themeEntity = this.hass.states[theme];
      entityState = themeEntity.state;
      isSelectEntity = theme.toLowerCase().includes('select');
    } else {
      return;
    }

    // 如果状态没有变化，跳过更新
    if (entityState === this._lastThemeEntityState) {
      return;
    }
    this._lastThemeEntityState = entityState;

    // 确定主题名称
    const themeName = this._determineThemeFromEntityState(entityState, isSelectEntity);

    // 保存主题名称
    this._lastThemeName = themeName;

    // 应用主题
    this._applyThemeInternal(themeName);
  }

  /**
   * 处理特殊主题模式
   * @param {string|object} theme - 主题配置
   * @returns {object|null} { themeName, needsListener }
   */
  _handleSpecialThemeMode(theme) {
    const [darkTheme, lightTheme] = this._parseDarkLightTheme();
    
    if (theme === 'off') return { themeName: darkTheme, needsListener: false };
    if (theme === 'on') return { themeName: lightTheme, needsListener: false };
    if (theme === 'time') return { themeName: this._getThemeByTime(), needsListener: true };
    if (theme === 'phone' || theme === 'device') return { themeName: this._getSystemTheme(), needsListener: true };
    
    return null;
  }

  /**
   * 处理实体主题配置
   * @param {string} theme - 实体ID
   * @returns {string|null} 主题名称
   */
  _handleEntityTheme(theme) {
    if (this.hass && this.hass.states[theme]) {
      return this._determineTheme(this.hass.states[theme].state);
    }
    return null;
  }

  /**
   * 根据配置确定主题（统一处理）
   * @param {string|object} theme - 主题配置
   * @returns {string} 主题名称
   */
  _determineTheme(theme) {
    // 处理特殊模式
    const specialMode = this._handleSpecialThemeMode(theme);
    if (specialMode) return specialMode.themeName;
    
    // 处理对象配置
    if (typeof theme === 'object' && theme !== null) {
      if (theme.value && TimerControlCard.COLOR_SCHEMES[theme.value]) {
        return theme.value;
      }
      if (theme.entity && this.hass) {
        const entityTheme = this._handleEntityTheme(theme.entity);
        if (entityTheme) return entityTheme;
      }
    }
    
    // 处理字符串（实体或主题名）
    if (typeof theme === 'string') {
      // 检查是否是实体
      const entityTheme = this._handleEntityTheme(theme);
      if (entityTheme) return entityTheme;
      
      // 检查是否是预定义主题
      if (TimerControlCard.COLOR_SCHEMES[theme]) {
        return theme;
      }
    }
    
    return this._parseDarkLightTheme()[1]; // 默认返回亮色主题
  }

  /**
   * 根据实体状态确定主题名称
   * @param {string} entityState - 实体状态
   * @param {boolean} isSelectEntity - 是否是下拉选择实体
   * @returns {string} 主题名称
   */
  _determineThemeFromEntityState(entityState, isSelectEntity) {
    // 下拉选择实体：检查是否是预定义的主题名称
    if (isSelectEntity && TimerControlCard.COLOR_SCHEMES[entityState]) {
      return entityState;
    }
    
    // 复用_determineTheme逻辑处理特殊值
    return this._determineTheme(entityState);
  }

  /**
   * 解析暗亮主题配置
   * @returns {array} [darkTheme, lightTheme]
   */
  _parseDarkLightTheme() {
    const darkLightTheme = this._darkLightTheme;
    if (darkLightTheme && typeof darkLightTheme === 'string') {
      const parts = darkLightTheme.split(',').map(p => p.trim());
      if (parts.length === 2) {
        const validThemes = Object.keys(TimerControlCard.COLOR_SCHEMES);
        const darkTheme = validThemes.includes(parts[0]) ? parts[0] : 'dark';
        const lightTheme = validThemes.includes(parts[1]) ? parts[1] : 'light';
        return [darkTheme, lightTheme];
      }
    }
    return ['dark', 'light'];
  }

  /**
   * 根据时间获取主题
   * @returns {string} 主题名称
   */
  _getThemeByTime() {
    const hour = new Date().getHours();
    const [darkTheme, lightTheme] = this._parseDarkLightTheme();
    return (hour >= 6 && hour < 18) ? lightTheme : darkTheme;
  }

  /**
   * 获取系统主题
   * @returns {string} 主题名称
   */
  _getSystemTheme() {
    const [darkTheme, lightTheme] = this._parseDarkLightTheme();
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return darkTheme;
    }
    return lightTheme; // 默认亮色
  }

  /**
   * 停止主题定时器
   */
  _stopThemeTimer() {
    if (this._themeTimer) {
      clearInterval(this._themeTimer);
      this._themeTimer = null;
    }
  }

  /**
   * 启动或关闭主题监听器（统一管理）
   * @param {boolean} enable - 是否启用
   */
  _toggleThemeListener(enable = true) {
    // 停止主题定时器
    this._stopThemeTimer();
    
    // 清理系统主题媒体查询监听
    if (this._systemThemeMediaQuery) {
      if (this._systemThemeMediaQuery.removeEventListener) {
        this._systemThemeMediaQuery.removeEventListener('change', this._systemThemeChangeHandler);
      }
      this._systemThemeMediaQuery = null;
    }

    if (enable) {
      // 设置系统主题监听
      if (window.matchMedia) {
        this._systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        this._systemThemeChangeHandler = (e) => {
          const themeName = e.matches ? this._parseDarkLightTheme()[0] : this._parseDarkLightTheme()[1];
          this._applyThemeInternal(themeName);
        };
        this._systemThemeMediaQuery.addEventListener('change', this._systemThemeChangeHandler);
      }
      
      // 启动时间主题定时器
      this._themeTimer = setInterval(() => {
        const currentTheme = this._getThemeByTime();
        if (this._lastThemeName !== currentTheme) {
          this._lastThemeName = currentTheme;
          this._applyThemeInternal(currentTheme);
        }
      }, 60000);
    }
  }

  /**
   * 应用主题变量到根元素和全局作用域
   * @param {string} themeName - 主题名称
   */
  _applyThemeVariables(themeName) {
    const theme = TimerControlCard.COLOR_SCHEMES[themeName] || TimerControlCard.COLOR_SCHEMES.light;
    
    // 应用到卡片根元素
    const root = this.shadowRoot ? this.shadowRoot.querySelector('.container') : null;
    if (root) {
      Object.keys(theme).forEach(key => {
        root.style.setProperty(key, theme[key]);
      });
    }
    
    // 同时应用到documentElement，让全局弹窗可以访问这些变量
    if (document.documentElement) {
      Object.keys(theme).forEach(key => {
        document.documentElement.style.setProperty(key, theme[key]);
      });
    }
  }

  /**
   * 统一应用主题
   * @param {string} themeName - 主题名称
   */
  _applyThemeInternal(themeName) {
    const previousTheme = this._currentTheme;
    this._currentTheme = themeName;
    
    // 应用CSS变量
    this._applyThemeVariables(themeName);
    
    // 更新外部弹窗的主题
    this._updatePopupThemes(themeName);
    
    // 主题变化时触发更新
    if (previousTheme !== themeName) {
      this.requestUpdate();
    }
  }

  /**
   * 更新弹出窗口的主题
   * @param {string} themeName - 主题名称
   */
  _updatePopupThemes(themeName) {
    const theme = TimerControlCard.COLOR_SCHEMES[themeName] || TimerControlCard.COLOR_SCHEMES.light;
    
    // 更新设置弹窗
    if (this._externalPopup) {
      const popup = this._externalPopup.querySelector('.timer-popup');
      if (popup) {
        this._applyThemeToPopup(popup, themeName);
      }
      const overlay = this._externalPopup.querySelector('.timer-popup-overlay');
      if (overlay) {
        overlay.style.background = theme['--timer-overlay-bg'];
      }
    }
    
    // 更新任务列表弹窗
    if (this._externalTaskListPopup) {
      const popup = this._externalTaskListPopup.querySelector('.timer-task-list-popup');
      if (popup) {
        this._applyThemeToPopup(popup, themeName);
      }
      const overlay = this._externalTaskListPopup.querySelector('.timer-popup-overlay');
      if (overlay) {
        overlay.style.background = theme['--timer-overlay-bg'];
      }
    }
  }

  /**
   * 应用主题到指定弹窗元素
   * @param {HTMLElement} popup - 弹窗元素
   * @param {string} themeName - 主题名称
   */
  _applyThemeToPopup(popup, themeName) {
    if (!popup) return;
    
    const theme = TimerControlCard.COLOR_SCHEMES[themeName] || TimerControlCard.COLOR_SCHEMES.light;
    
    // 移除所有主题类
    const themeClasses = ['dark', 'light', 'black', 'darkgray', 'transparent'];
    popup.classList.remove(...themeClasses.map(t => `theme-${t}`));
    // 添加对应的主题类
    popup.classList.add(`theme-${themeName}`);
    
    // 应用CSS变量
    Object.keys(theme).forEach(key => {
      popup.style.setProperty(key, theme[key]);
    });
  }

  /**
   * 清理主题资源
   */
  _cleanupTheme() {
    this._toggleThemeListener(false);
    this._themeConfig = null;
    this._lastThemeName = null;
    this._lastThemeEntityState = null;
  }

  /**
   * 获取当前主题名称
   * @returns {string} 当前主题名称
   */
  getCurrentTheme() {
    return this._currentTheme;
  }

  /**
   * 判断当前主题是否为暗色主题
   * @returns {boolean} 是否为暗色主题
   */
  _isDarkTheme() {
    const currentTheme = this._currentTheme || 'light';
    const darkThemes = ['dark', 'black', 'darkgray', 'transparent'];
    return darkThemes.includes(currentTheme);
  }
  
  static getStubConfig() {
    return {
      theme: "input_select.theme",
      dark_light_theme: "dark,light",
      show_buttons: false,
      card_style: "normal",
      normal_height: "150px",
      time_box_progress_background: "#a8c97f"
    };
  }
}

// 注册自定义卡片
if (!customElements.get('timer-control-card')) {
  customElements.define('timer-control-card', TimerControlCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "timer-control-card",
  name: "定时任务中心",
  description: "定时任务卡片",
  preview: true,
  documentationURL: "https://github.com/chjspp520/timer-control-card"
});
