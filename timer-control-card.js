const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class TimerControlCard extends LitElement {
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
    this._syncInterval = null;
    this._pollingInterval = null;  // 新增：轮询定时器
    this._lastSyncTime = 0;
    this._lastSyncSuccessTime = 0;  // 新增：最后成功同步时间
    this._isVisible = false;
    this._visibilityObserver = null;
    this._retryCount = 0;  // 新增：重试次数
    this._maxRetries = 3;  // 新增：最大重试次数
    this._activeTimersList = [];  // 新增：正在执行的任务列表
    this._searchKeyword = '';  // 新增：搜索关键词
    this._showSearchDropdown = false;  // 新增：是否显示搜索下拉框
    this._selectedCategory = 'lights';  // 新增：默认选中的分类
    this._timerMode = 'countdown';  // 新增：计时模式
    this._activeTimersCount = 0;  // 新增：正在执行的任务个数
    this._eventListeners = [];  // 新增：事件监听器列表
    this._showTaskList = false;  // 新增：是否显示任务清单
    this._currentTaskIndex = 0;  // 新增：当前显示的任务索引
    this._scrollTimeout = null;  // 新增：滚动超时定时器
    this._autoScrollInterval = null;  // 新增：3D自动滚动定时器
    this._3dScrollSpeed = 2000;  // 新增：3D滚动速度（毫秒）
    this._scrollOffset = 0;  // 新增：滚动偏移量
    this._recurringInterval = 'daily';  // 新增：周期定时间隔
    this._recurringDays = [];  // 新增：周期定时的日期选择
    this._monthlyDropdownOpen = false;  // 新增：每月下拉框是否打开
    this._selectedMonthlyDay = null;  // 新增：选中的每月日期
    this._deviceSectionExpanded = false;  // 新增：设备选择区域是否展开
    this._selectedHours = 0;  // 新增：选中的小时
    this._selectedMinutes = 30  // 新增：选中的分钟
    this._pickerDefaultDuration = '00:30:00'  // 新增：时间选择器的默认时长
    this._activeSchedulesList = []  // 新增：周期任务列表
    this._scheduleUpdateInterval = null  // 新增：周期任务倒计时更新定时器

    // 绑定事件处理函数
    this.handleBackendResponse = this.handleResponse.bind(this);
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
      // normal样式高度配置
      normal_height: config.normal_height || '100px',
      // normal样式背景色配置
      normal_background: config.normal_background || 'transparent',
      ...config
    };
    
    this._duration = this.config.default_duration;
    this._selectedEntity = this.config.entity;
    this._debugInfo = `配置加载: ${this.config.entity}`;
    
    // 初始化时间选择器的默认时长和选中值
    this._pickerDefaultDuration = this.config.default_duration || '00:30:00';
    const [hours, minutes, seconds] = this._pickerDefaultDuration.split(':').map(Number);
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
    
    // 如果已经有hass对象，立即同步并加载实体列表
    if (this.hass && this.hass.connection) {
      this._hassReady = true;
      this.loadAvailableEntities();
      this.syncImmediately();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    
    // 移除正常状态的debug信息更新
    
    // 监听后端响应事件 - 通过Home Assistant WebSocket连接
    this.setupHassEventListener();
    
    // 同时设置window事件监听作为备用
    this.setupWindowEventListener();
    

    
    // 启动可见性观察
    this.setupVisibilityObserver();
    
    // 启动倒计时循环
    this.startCountdownLoop();
    
    // 启动轮询机制
    this.startPollingLoop();
    
    // 立即尝试同步定时器状态（不等待hass更新）
    if (this.config?.entity) {
      setTimeout(() => {
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
    
    // 停止所有定时器
    this.stopCountdownLoop();
    this.stopSyncLoop();
    this.stopPollingLoop();
    
    // 停止可见性观察
    this.stopVisibilityObserver();
    
    // 清除超时定时器
    if (this._syncTimeout) {
      clearTimeout(this._syncTimeout);
      this._syncTimeout = null;
    }
    
    // 清除滚动超时定时器
    if (this._scrollTimeout) {
      clearTimeout(this._scrollTimeout);
      this._scrollTimeout = null;
    }
    
    // 清除3D自动滚动定时器
    this.stop3DAutoScroll();
    
    // 移除 Home Assistant 事件监听器（会自动清理）
    if (this.hass && this.hass.connection) {
      // Home Assistant 会自动清理事件监听器
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
    try {
      await this.sendEventSafe({
        action: 'get_all_timers',
        user_id: 'user'
      });
      
      return true;
      
    } catch (error) {
      this._debugInfo = `刷新失败: ${error.message}`;
      throw error;
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
        setTimeout(() => this.forceSyncTimers(), 1000);
        return;
      }
      
      // 检查事件监听器是否设置
      if (!this._hassReady) {

        this.setupHassEventListener();
      }
      
      // 发送事件
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
      setTimeout(() => this.forceSyncTimers(), 2000);
    }
  }

  // 新增：加载可用实体
  loadAvailableEntities() {
    if (!this.hass || !this.hass.states) {
      setTimeout(() => this.loadAvailableEntities(), 1000);
      return;
    }

    const entities = Object.keys(this.hass.states);
    const categorizedEntities = {
      lights: [],
      climate: [],
      fan: [],
      media: [],
      switch: []
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
    });

    this._availableEntities = categorizedEntities;
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
      setTimeout(() => this.refreshTimersWithRetry(), 1000);
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
      
      // 设置超时检查，如果5秒内没收到响应，再次尝试
      this._syncTimeout = setTimeout(() => {
        if (!this._timerInfo && this._isVisible) {

          this.performRefreshWithRetry();
        }
      }, 5000);
      
    } catch (error) {
      this._debugInfo = `刷新失败: ${error.message}`;
      this._lastSyncFailed = true;  // 标记同步失败
      
      // 指数退避重试
      const delay = Math.min(1000 * Math.pow(2, this._retryCount), 10000);
      setTimeout(() => {
        this.performRefreshWithRetry();
      }, delay);
    }
  }

  setupHassEventListener() {
    // 设置 Home Assistant 事件监听器
    if (this.hass && this.hass.connection) {
      try {
        this.hass.connection.subscribeEvents((event) => {
          this.handleResponse(event);
        }, 'timer_backend_response');
      } catch (error) {

        // 备用方案：使用window事件监听
        this.setupWindowEventListener();
      }
    } else {
      // 如果hass还未准备好，延迟设置
      setTimeout(() => this.setupHassEventListener(), 1000);
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
              // 卡片变为可见时立即强制同步（不等待hass就绪）
              setTimeout(() => {
                this.forceSyncTimers();
              }, 100);
              
              // 确保倒计时循环正在运行
              if (!this._countdownInterval) {
                this.startCountdownLoop();
              }
              
              // 确保同步循环正在运行
              if (!this._syncInterval) {
                this.startSyncLoop();
              }
              
              // 启动3D自动滚动
              if (this._activeTimersList && this._activeTimersList.length > 1) {
                this.start3DAutoScroll();
              }
            } else {
              // 卡片不可见时停止3D滚动以节省资源
              this.stop3DAutoScroll();
            }
          });
        },
        {
          threshold: 0.1, // 至少10%可见
          rootMargin: '50px' // 预加载区域
        }
      );
      
      // 开始观察
      setTimeout(() => {
        if (this.shadowRoot) {
          const container = this.shadowRoot.querySelector('.container');
          if (container && this._visibilityObserver) {
            this._visibilityObserver.observe(container);
          }
        }
      }, 100);
    }
  }

  stopVisibilityObserver() {
    if (this._visibilityObserver) {
      this._visibilityObserver.disconnect();
      this._visibilityObserver = null;
    }
  }

  // 启动轮询循环
  startPollingLoop() {
    this.stopPollingLoop();
    
    this._pollingInterval = setInterval(() => {
      // 如果卡片可见且Hass就绪，检查后端
      if (this._isVisible && this._hassReady) {
        this.refreshTimersSafe();
      }
      
      // 如果超过60秒没有成功同步，强制重试
      const now = Date.now();
      if (now - this._lastSyncSuccessTime > 60000) {
        this.refreshTimersWithRetry();
      }
    }, 15000); // 每15秒检查一次
  }

  // 停止轮询循环
  stopPollingLoop() {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
      this._pollingInterval = null;
    }
  }

  syncImmediately() {
    if (!this._hassReady) {
      return;
    }
    this.refreshTimersWithRetry();
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    
    // 如果每月下拉框处于打开状态，重新定位它
    if (this._monthlyDropdownOpen) {
      setTimeout(() => {
        this.positionMonthlyDropdown();
      }, 10);
    }
    
    // 当hass对象变为可用时，立即同步
    if (changedProperties.has('hass') && this.hass) {
      // 移除正常状态的debug信息更新
      
      // 等待连接建立
      setTimeout(() => {
        if (this.hass && this.hass.connection) {
          this._hassReady = true;

          
          // 设置事件监听器
          this.setupHassEventListener();
          
          // 加载可用实体
          this.loadAvailableEntities();
          
          // 启动同步循环
          if (!this._syncInterval) {
            this.startSyncLoop();
          }
          
          // 立即同步一次
          this.syncImmediately();
        }
      }, 1000);
    }
  }

  startSyncLoop() {
    this.stopSyncLoop();
    
    this._syncInterval = setInterval(() => {
      if (this._isVisible && this._hassReady) {
        this.refreshTimersSafe();
      }
    }, 30000); // 每30秒同步一次
  }

  stopSyncLoop() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
  }

  startCountdownLoop() {
    this.stopCountdownLoop();
    
    this._countdownInterval = setInterval(() => {
      // 如果有定时器信息，进行倒计时
      if (this._timerInfo && this._remainingSeconds > 0) {
        this._remainingSeconds--;
        this._progress = this._totalSeconds > 0 ? 
          (this._remainingSeconds / this._totalSeconds) * 100 : 100;
        this.requestUpdate();
        
        // 定期同步（每30秒）以确保时间准确
        const now = Date.now();
        if (now - this._lastSyncSuccessTime > 30000) {
          this.refreshTimersSafe();
        }
        
        if (this._remainingSeconds <= 0) {
          this._timerInfo = null;
          this._timer = null;
          this._progress = 100;
          this._remainingSeconds = 0;
          this._pendingTimerRestore = false;
          this.requestUpdate();
          
          // 定时器结束后同步后端状态
          setTimeout(() => this.refreshTimersSafe(), 2000);
        }
      }
      // 如果没有定时器信息，定期检查后端状态
      else if (!this._timerInfo && this._isVisible && this._hassReady) {
        const now = Date.now();
        // 如果超过10秒没有同步，主动检查一次
        if (now - this._lastSyncTime > 10000) {
          this.refreshTimersSafe();
        }
      }
    }, 1000);
  }

  stopCountdownLoop() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  static get styles() {
    return css`
      .container {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0px;
        min-height: 0px;
        
        /* 移动端适配 - 保持水平布局 */
        @media (max-width: 768px) {
          flex-direction: row;
          gap: 10px;
          padding: 0px;
          min-height: 0px;
        }
        
        @media (max-width: 480px) {
          gap: 10px;
          padding: 0px;
          min-height: 0px;
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
        
        /* 移动端适配 */
        @media (max-width: 768px) {
          width: var(--time-box-width, 100%);
          height: var(--time-box-height, auto);
          min-height: var(--time-box-height, 50px);
          font-size: var(--time-box-font-size, 18px);
          padding: 1px;
        }
        
        @media (max-width: 480px) {
          font-size: var(--time-box-font-size, 16px);
          height: var(--time-box-height, auto);
          min-height: var(--time-box-height, 45px);
          padding: 1px;
        }
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
        color: #ffffffff;
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
      
      /* 任务内容容器 - 用于实现连续滚动 */
      .task-scroll-content {
        position: relative;
        padding: 2px 0px 2px 0px;
        will-change: transform;
        overflow: visible; /* 允许内容溢出 */
      }
      
      /* 无缝循环滚动的关键：将任务列表复制多份 */
      .task-scroll-content.has-scroll {
        animation: scrollLoop 10s linear infinite;
      }
      
      @keyframes scrollLoop {
        0% {
          transform: translateY(0);
        }
        100% {
          transform: translateY(-33.33%); /* 滚动一个完整列表的高度（因为有三份列表） */
        }
      }
      
      .task-scroll-container::-webkit-scrollbar {
        display: none; /* Chrome, Safari和Opera隐藏滚动条 */
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
        padding: 10px 20px 10px 20px;
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
        margin-bottom: 2px;
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
    const isSyncing = this._retryCount > 0 && this._retryCount < this._maxRetries && !hasTimer;
    const isRestoring = this._pendingTimerRestore && hasTimer;
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
          </div>
        </div>
        
        <!-- 任务清单弹窗 -->
        ${this._showTaskList ? this.renderTaskList() : ''}
        
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
        
        ${this._showSettings ? this.renderSettings() : ''}
      </div>
    `;
  }

  renderNormalStyle(hasTimer, displayTime, isConnected, showSyncError, showConnectionStatus) {
    // 计算一次显示的任务数量 - 考虑CSS padding和标题高度的影响
    const heightValue = parseInt(this.config.normal_height) || 100;
    const taskHeight = 30; // 每条任务的高度
    const titleHeight = 30; // 标题区域的高度
    const containerPadding = 0; // 容器内边距（已包含在CSS中）
    const availableHeight = heightValue - titleHeight - containerPadding;
    const maxVisibleTasks = Math.max(1, Math.floor(availableHeight / taskHeight));
    
    // 检查是否需要滚动：如果任务总数超过可见数量，则需要滚动
    const needsScroll = this._activeTimersList && this._activeTimersList.length > maxVisibleTasks;
    
    // 获取当前显示的任务（不需要滚动时不重复，需要滚动时复制多份以实现无缝循环）
    const visibleTasks = this.getVisibleTasks(maxVisibleTasks, needsScroll);
    
    // 检查是否有更多任务可以滚动（只有需要滚动时才检查）
    const hasMoreTasksAbove = needsScroll && this._currentTaskIndex > 0;
    const hasMoreTasksBelow = needsScroll && this._currentTaskIndex + maxVisibleTasks < this._activeTimersList.length;
    
    // 转换进度条背景色为RGB格式
    const progressRgb = this.hexToRgb(this.config.time_box_progress_background || '#1976d2');
    const progressRgbValue = progressRgb ? `${progressRgb.r}, ${progressRgb.g}, ${progressRgb.b}` : '0, 122, 255';
    
    return html`
      <div 
        class="normal-container" 
        @click=${this.toggleTaskList} 
        style="
          height: ${this.config.normal_height};
          background: ${this.config.normal_background};
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
        
        <!-- 任务倒计时滚动显示 -->
        <div class="task-scroll-container" style="overflow: ${needsScroll ? 'hidden' : 'visible'};">
          <!-- 连续滚动内容容器 -->
          <div 
            class="task-scroll-content" 
            style="transform: translateY(-${needsScroll ? (this._scrollOffset || 0) : 0}px);"
          >
            ${this._activeTimersList && this._activeTimersList.length > 0 ? html`
              ${visibleTasks.map((task, index) => {
              // 检查是否为周期任务
              const isSchedule = task.is_schedule;
              
              if (isSchedule) {
                // 周期任务显示
                const countdownSeconds = task.schedule_countdown || 0;
                
                return html`
                  <div class="task-item schedule-item" data-entity-id="${task.entity_id}" data-index="${index}">
                    <!-- 周期任务进度条（使用不同的颜色） -->
                    <div class="task-progress-bar schedule-progress" style="width: 100%;"></div>
                    <div class="task-content">
                      <div class="task-number schedule-number">${(index % this._activeTimersList.length) + 1}</div>
                      <div class="task-entity-name">${this.getEntityFriendlyName(task.entity_id)}</div>
                      <div class="task-time schedule-time">
                        <div class="schedule-countdown">${this.formatTaskTime(countdownSeconds)}</div>
                      </div>
                    </div>
                  </div>
                `;
              } else {
                // 普通定时器显示
                const totalSeconds = task.duration ? this.durationToSeconds(task.duration) : 1800; // 默认30分钟
                const remainingSeconds = task.remaining_seconds || 0;
                const progressPercent = totalSeconds > 0 ? (1 - remainingSeconds / totalSeconds) * 100 : 0;
                const remainingPercent = 100 - progressPercent;
                
                return html`
                  <div class="task-item" data-entity-id="${task.entity_id}" data-index="${index}">
                    <!-- 进度条背景 -->
                    <div class="task-progress-bar" style="width: ${progressPercent}%;"></div>
                    <div class="task-progress-remaining" style="width: ${remainingPercent}%;"></div>
                    <div class="task-content">
                      <div class="task-number">${(index % this._activeTimersList.length) + 1}</div>
                      <div class="task-entity-name">${this.getEntityFriendlyName(task.entity_id)}</div>
                      <div class="task-time">${this.formatTaskTime(remainingSeconds)}</div>
                    </div>
                  </div>
                `;
              }
            })}
            ` : html`
              <!-- 没有任务时显示 -->
              <div class="no-tasks-message">暂无任务</div>
            `}
          </div>
        </div>
        
        <!-- 任务清单弹窗 -->
        ${this._showTaskList ? this.renderTaskList() : ''}
        
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
        
        ${this._showSettings ? this.renderSettings() : ''}
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
      const weekdaysText = schedule.weekdays.map(day => weekdayMap[day.toLowerCase()] || day).join('、');
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





  // 处理滚动事件
  // 获取用于显示的任务列表
  getVisibleTasks(maxVisibleTasks, needsScroll = false) {
    if (!this._activeTimersList || this._activeTimersList.length === 0) {
      return [];
    }
    
    // 如果不需要滚动，直接返回原始任务列表，不重复
    if (!needsScroll) {
      return this._activeTimersList;
    }
    
    // 需要滚动时，为了实现连续无缝滚动，我们需要复制任务列表
    // 当任务数量较少时，复制多份以填满滚动区域
    const tasks = [];
    const originalLength = this._activeTimersList.length;
    
    // 计算需要多少份任务列表才能填满滚动区域
    const totalCopies = Math.max(3, Math.ceil(maxVisibleTasks * 2 / originalLength) + 1);
    
    for (let i = 0; i < totalCopies; i++) {
      tasks.push(...this._activeTimersList);
    }
    
    return tasks;
  }

  handleScroll(event) {
    const container = event.target;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // 立即更新显示
    this.requestUpdate();
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

  renderSettings() {
    const [hours = "0", minutes = "30", seconds = "0"] = this._duration.split(':');
    
    // 根据card_style决定初始折叠状态
    const isMiniMode = this.config.card_style === 'mini' && this.config.entity;
    const isNormalMode = this.config.card_style === 'normal';
    
    // 确定当前折叠状态和图标
    const isExpanded = this._deviceSectionExpanded;
    const collapseIcon = isExpanded ? '▼' : '▶';
    
    return html`
      <div class="popup-overlay" @click=${this.closeSettings}>
        <div class="popup" @click=${e => e.stopPropagation()}>
          <div class="popup-header">
            <div class="popup-title">添加定时器</div>
            <button class="popup-close" @click=${this.closeSettings}>×</button>
          </div>
          
          <!-- 设备选择 -->
          <div class="device-selection-section">
            <div 
              style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; margin-bottom: 10px;"
              @click=${() => {
                // 切换展开状态
                this._deviceSectionExpanded = !this._deviceSectionExpanded;
                this.requestUpdate();
              }}
            >
              <div class="device-section-title">${collapseIcon} 选择设备</div>
              
              <!-- 搜索框放在同一行右侧 -->
              ${isExpanded ? html`
                <div style="position: relative;">
                  <input 
                    type="text" 
                    class="search-input" 
                    placeholder="搜索实体..."
                    style="width: 200px;"
                    .value=${this._searchKeyword}
                    @input=${e => this.searchEntities(e.target.value)}
                    @focus=${() => { this._showSearchDropdown = true; }}
                    @blur=${() => { setTimeout(() => { this._showSearchDropdown = false; }, 200); }}
                    @click=${(e) => e.stopPropagation()}  // 防止点击搜索框时触发折叠/展开
                  >
                  
                  ${this._searchKeyword && this._searchKeyword.trim() ? html`
                    <button 
                      style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #666; font-size: 16px;"
                      @click=${(e) => {
                        this._searchKeyword = '';
                        this._showSearchDropdown = false;
                        this.requestUpdate();
                        e.stopPropagation();
                      }}
                      title="清除搜索"
                    >
                      ×
                    </button>
                  ` : ''}
                  
                  <!-- 下拉搜索结果 -->
                  ${this._showSearchDropdown && this._searchKeyword && this._searchKeyword.trim() ? html`
                    <div class="search-results" style="position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 6px 6px; max-height: 200px; overflow-y: auto; z-index: 1000;">
                      ${(() => {
                        const allEntities = Object.values(this._availableEntities).flat();
                        const searchResults = allEntities.filter(entity => 
                          entity.name.toLowerCase().includes(this._searchKeyword.toLowerCase()) ||
                          entity.id.toLowerCase().includes(this._searchKeyword.toLowerCase())
                        );
                        
                        if (searchResults.length === 0) {
                          return html`
                            <div style="text-align: center; color: #000000; padding: 20px; opacity: 0.7;">
                              未找到匹配的设备
                            </div>
                          `;
                        }
                        
                        return html`
                          <div class="entity-list">
                            ${searchResults.map(entity => html`
                              <div 
                                class="entity-item ${this._selectedEntity === entity.id ? 'selected' : ''}"
                                @click=${(e) => {
                                  this.selectEntityFromSearch(entity.id);
                                  e.stopPropagation();
                                }}
                                style="padding: 0px 3px;"
                              >
                                <div class="entity-name" style="color: #000;">${entity.name}</div>
                                <div class="entity-id" style="font-size: 10px;">${entity.id}</div>
                              </div>
                            `)}
                          </div>
                        `;
                      })()}
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
            
            <!-- 展开的内容 -->
            ${isExpanded ? html`
              <!-- 横向分类标签 -->
              <div class="category-tabs">
                ${Object.entries(this._availableEntities).map(([category, entities]) => {
                  if (entities.length === 0) return '';
                  const categoryNames = {
                    lights: '灯光',
                    climate: '气候',
                    fan: '风扇',
                    media: '媒体',
                    switch: '开关'
                  };
                  return html`
                    <button 
                      class="category-tab ${this._selectedCategory === category ? 'active' : ''}"
                      @click=${() => this.selectCategory(category)}
                    >
                      ${categoryNames[category] || category}
                    </button>
                  `;
                })}
              </div>
              
              <!-- 设备选择区域 -->
              <div class="entity-categories">
                ${(() => {
                  const entities = this._availableEntities[this._selectedCategory] || [];
                  const categoryNames = {
                    lights: '灯光',
                    climate: '气候',
                    fan: '风扇',
                    media: '媒体',
                    switch: '开关'
                  };
                  
                  if (entities.length === 0) {
                    return html`
                      <div style="text-align: center; color: #000000; padding: 20px;">
                        没有找到${categoryNames[this._selectedCategory] || this._selectedCategory}设备
                      </div>
                    `;
                  }
                  
                  return html`
                    <div class="entity-list">
                      ${entities.map(entity => html`
                        <div 
                          class="entity-item ${this._selectedEntity === entity.id ? 'selected' : ''}"
                          @click=${() => this.selectEntity(entity.id)}
                        >
                          <div class="entity-name" style="color: #000;">${entity.name}</div>
                          <div class="entity-id">${entity.id}</div>
                        </div>
                      `)}
                    </div>
                  `;
                })()}
              </div>
            ` : ''}
          </div>
          
          <!-- 定时时长设置 -->
          <div class="duration-section">
            <div class="section-header">
              <div class="duration-section-title">定时时长</div>
              <div class="timer-mode-buttons">
                <button 
                  class="mode-btn ${this._timerMode === 'countdown' ? 'active' : ''}"
                  @click=${() => this.setTimerMode('countdown')}
                >
                  倒计时
                </button>
                <button 
                  class="mode-btn ${this._timerMode === 'absolute_time' ? 'active' : ''}"
                  @click=${() => this.setTimerMode('absolute_time')}
                >
                  指定时间
                </button>
                <button 
                  class="mode-btn ${this._timerMode === 'recurring' ? 'active' : ''}"
                  @click=${() => this.setTimerMode('recurring')}
                >
                  周期定时
                </button>
              </div>
            </div>
            <div class="duration-container">
              <!-- 左侧时间输入框 -->
              <div class="time-inputs">
                <!-- 小时翻页钟 -->
                <div class="flip-clock-input" data-type="hours">
                  <div class="flip-clock-card">
                    <div class="flip-clock-face front">${hours}</div>
                    <div class="flip-clock-face back">${hours}</div>
                  </div>
                  <div class="flip-clock-top" @click=${() => this.incrementDuration('hours')} title="增加小时"></div>
                  <div class="flip-clock-bottom" @click=${() => this.decrementDuration('hours')} title="减少小时"></div>
                </div>
                
                <div class="colon-separator" style="align-self: center; margin: 0 5px;">:</div>
                
                <!-- 分钟翻页钟 -->
                <div class="flip-clock-input" data-type="minutes">
                  <div class="flip-clock-card">
                    <div class="flip-clock-face front">${minutes}</div>
                    <div class="flip-clock-face back">${minutes}</div>
                  </div>
                  <div class="flip-clock-top" @click=${() => this.incrementDuration('minutes')} title="增加分钟"></div>
                  <div class="flip-clock-bottom" @click=${() => this.decrementDuration('minutes')} title="减少分钟"></div>
                </div>
                
                <div class="colon-separator" style="align-self: center; margin: 0 5px;">:</div>
                
                <!-- 秒钟翻页钟 -->
                <div class="flip-clock-input" data-type="seconds">
                  <div class="flip-clock-card">
                    <div class="flip-clock-face front">${seconds}</div>
                    <div class="flip-clock-face back">${seconds}</div>
                  </div>
                  <div class="flip-clock-top" @click=${() => this.incrementDuration('seconds')} title="增加秒钟"></div>
                  <div class="flip-clock-bottom" @click=${() => this.decrementDuration('seconds')} title="减少秒钟"></div>
                </div>
              </div>
              
              <!-- 右侧区域：根据模式显示不同内容 -->
              ${this._timerMode === 'recurring' ? html`
                <!-- 周期定时设置 -->
                <div class="recurring-options">
                  <div class="interval-options">
                    <label class="interval-option">
                      <input type="radio" name="interval" value="daily" ?checked=${this._recurringInterval === 'daily'} @change=${() => this.setRecurringInterval('daily')}>
                      <span class="interval-label">天</span>
                    </label>
                    <label class="interval-option">
                      <input type="radio" name="interval" value="weekly" ?checked=${this._recurringInterval === 'weekly'} @change=${() => this.setRecurringInterval('weekly')}>
                      <span class="interval-label">周</span>
                    </label>
                    <label class="interval-option">
                      <input type="radio" name="interval" value="monthly" ?checked=${this._recurringInterval === 'monthly'} @change=${(e) => {
                        this.setRecurringInterval('monthly');
                        this._monthlyDropdownOpen = true;
                        setTimeout(() => this.positionMonthlyDropdown(), 10);
                        e.stopPropagation();
                      }}>
                      <span class="interval-label" @click=${(e) => {
                        if (this._recurringInterval === 'monthly') {
                          this._monthlyDropdownOpen = !this._monthlyDropdownOpen;
                          if (this._monthlyDropdownOpen) {
                            setTimeout(() => this.positionMonthlyDropdown(), 10);
                          }
                        } else {
                          this.setRecurringInterval('monthly');
                          this._monthlyDropdownOpen = true;
                          setTimeout(() => this.positionMonthlyDropdown(), 10);
                        }
                        e.stopPropagation();
                        e.preventDefault();
                      }}>月</span>
                    </label>
                    
                    ${this._recurringInterval === 'monthly' && this._monthlyDropdownOpen ? html`
                      <!-- 每月日期多选网格 -->
                      <div class="monthly-grid-dropdown" @click=${(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}>
                        ${Array.from({length: 31}, (_, i) => i + 1).map(day => html`
                          <button 
                            class="monthly-day-btn ${this._recurringDays.includes(day) ? 'selected' : ''}"
                            @click=${(e) => {
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
                              e.stopPropagation();
                              e.preventDefault();
                              this.requestUpdate();
                            }}
                          >
                            ${day}
                          </button>
                        `)}
                        <!-- 添加确认和关闭按钮 -->
                        <button 
                          class="monthly-day-btn monthly-close-btn"
                          @click=${(e) => {
                            this._monthlyDropdownOpen = false;
                            e.stopPropagation();
                            e.preventDefault();
                            this.requestUpdate();
                          }}
                          title="关闭"
                        >
                          ×
                        </button>
                        <button 
                          class="monthly-day-btn monthly-confirm-btn"
                          @click=${(e) => {
                            this._monthlyDropdownOpen = false;
                            // 更新选中的日期显示
                            if (this._recurringDays.length > 0) {
                              this._selectedMonthlyDay = this._recurringDays[0];
                            } else {
                              this._selectedMonthlyDay = null;
                            }
                            e.stopPropagation();
                            e.preventDefault();
                            this.requestUpdate();
                          }}
                          title="确认选择"
                        >
                          √
                        </button>
                      </div>
                    ` : ''}
                  </div>
                  
                  <!-- 显示选中的每月日期 -->
                  ${this._recurringInterval === 'monthly' && this._selectedMonthlyDay ? html`
                    <div class="monthly-selection-display" style="margin-top: 10px; text-align: center; font-size: 11px; color: #007aff;">
                      已选择: ${this._recurringDays.map(day => `${day}日`).join(', ')}
                    </div>
                  ` : ''}
                  
                  ${this._recurringInterval === 'weekly' ? html`
                    <div class="days-selection">
                      <div class="days-grid">
                        ${['一', '二', '三', '四', '五', '六', '日'].map((day, index) => html`
                          <button 
                            class="day-btn ${this._recurringDays.includes(index) ? 'selected' : ''}"
                            @click=${() => this.toggleRecurringDay(index)}
                          >
                            ${day}
                          </button>
                        `)}
                      </div>
                    </div>
                  ` : ''}
                </div>
              ` : html`
                <!-- 快速时间选择 - 根据模式显示不同值 -->
                <div class="quick-durations">
                  ${this._timerMode === 'countdown' ? html`
                    <!-- 倒计时模式快速选择 -->
                    <button class="quick-btn" @click=${() => this.setQuickDuration(5)}>5分钟</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration(10)}>10分钟</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration(30)}>30分钟</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration(60)}>1小时</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration(120)}>2小时</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration(360)}>6小时</button>
                  ` : html`
                    <!-- 指定时间模式快速选择 -->
                    <button class="quick-btn" @click=${() => this.setQuickDuration('08:00:00')}>08:00</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration('12:00:00')}>12:00</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration('14:00:00')}>14:00</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration('16:00:00')}>16:00</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration('20:00:00')}>20:00</button>
                    <button class="quick-btn" @click=${() => this.setQuickDuration('23:00:00')}>23:00</button>
                  `}
                </div>
              `}
              
            </div>
          </div>

        <!-- 动作设置 -->
          <div class="action-section">
            <div class="action-section-title">定时动作</div>
            <div class="action-options">
              <label class="action-option">
                <input type="radio" name="action" value="turn_off" checked>
                <span class="action-label">关闭</span>
              </label>
              <label class="action-option">
                <input type="radio" name="action" value="turn_on">
                <span class="action-label">开启</span>
              </label>
              <label class="action-option">
                <input type="radio" name="action" value="toggle">
                <span class="action-label">切换</span>
              </label>
            </div>
          </div>

          <!-- 按钮区域 -->
          <div class="popup-footer">
            <button class="popup-btn" @click=${this.closeSettings}>取消</button>
            <button class="popup-btn save-btn" @click=${this.saveSettings}>确定</button>
          </div>
          

        </div>
      </div>
    `;
  }

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
      
      // 发送创建定时器的事件
      await this.sendEventSafe({
        action: 'create_timer',
        entity_id: this._selectedEntity,
        duration: durationToSend,
        action_type: 'auto',
        user_id: 'user'
      });
      
      // 稍后刷新状态，从后端获取准确数据
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 1000);
      
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
      
      // 稍后刷新状态确认取消成功
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 1000);
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
        
        // 启动3D自动滚动
        if (this._activeTimersList.length > 0) {
          this.start3DAutoScroll();
        } else {
          this.stop3DAutoScroll();
          this._currentTaskIndex = 0;
        }
        
        // 启动周期任务倒计时更新
        this.startScheduleUpdate();
        
        // 移除成功时的debug信息更新
        
        // 找到当前实体的定时器
        const newTimer = data.timers?.find(t => t.entity_id === this._selectedEntity);
        
        if (newTimer) {
          this._timerInfo = newTimer;
          this._timer = newTimer;
          
          // 计算准确的剩余时间 - 优先使用end_time计算
          let remainingSeconds = 0;
          if (newTimer.end_time) {
            const endTime = new Date(newTimer.end_time).getTime();
            const now = Date.now();
            const remainingMs = Math.max(0, endTime - now);
            remainingSeconds = Math.floor(remainingMs / 1000);
          } else if (newTimer.remaining_seconds !== undefined) {
            // 确保只处理整数秒数，去掉小数部分
            remainingSeconds = Math.max(0, Math.floor(newTimer.remaining_seconds));
          }
          
          // 只有时间差超过3秒才更新，避免倒计时抖动
          const timeDiff = Math.abs(remainingSeconds - this._remainingSeconds);
          if (timeDiff > 3) {
            this._isTimeSyncing = true;
            this._remainingSeconds = remainingSeconds;
            // 2秒后清除同步状态
            setTimeout(() => {
              this._isTimeSyncing = false;
            }, 2000);
          }
          
          // 计算总时长和进度
          if (newTimer.duration) {
            this._totalSeconds = this.durationToSeconds(newTimer.duration);
            this._progress = this._totalSeconds > 0 ? 
              (this._remainingSeconds / this._totalSeconds) * 100 : 100;
          }
          
          // 清除超时定时器
          if (this._syncTimeout) {
            clearTimeout(this._syncTimeout);
            this._syncTimeout = null;
          }
          
          // 重置重试计数
          this._retryCount = 0;
          this._pendingTimerRestore = false;
          // 移除成功时的debug信息更新
          
          // 立即更新显示
          this.requestUpdate();
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
          // 移除正常状态的debug信息更新
          this.requestUpdate();
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
          this.requestUpdate();
        }
      } else if (data.action === 'timer_completed') {
        if (data.entity_id === this.config.entity) {
          this._timerInfo = null;
          this._timer = null;
          this._remainingSeconds = 0;
          this._progress = 100;
          this._pendingTimerRestore = false;
          this.requestUpdate();
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
        this.requestUpdate();
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
  }

  openAddTimer() {
    this._showSettings = true;
  }

  closeSettings() {
    this._showSettings = false;
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
    
    // 显示任务列表
    this._showTaskList = true;
    this.requestUpdate();
  }

  closeTaskList() {
    this._showTaskList = false;
    this.requestUpdate();
  }

  renderTaskList() {
    return html`
      <div class="popup-overlay" @click=${this.closeTaskList}>
        <div class="task-list-popup ${this._activeTimersList.length > 0 ? 'has-tasks' : ''}" @click=${e => e.stopPropagation()}>
          <div class="task-list-header">
            <div class="task-list-title">任务中心</div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="font-size: 11px; color: ${this._activeTimersList.length > 0 || this._activeSchedulesList.length > 0 ? '#ffffff' : '#8e8e93'}; background: ${this._activeTimersList.length > 0 || this._activeSchedulesList.length > 0 ? '#ee5a52' : '#f2f2f7'}; padding: 4px 12px; border-radius: 8px; font-weight: 500;">
                总任务: ${this._activeTimersList.length + this._activeSchedulesList.length}
              </div>
              <button 
                class="task-modify-btn" 
                @click=${this.openAddTimer}
                title="新增定时任务"
                style="padding: 4px 12px; font-size: 11px;"
              >
                新增
              </button>
              ${this._activeTimersList.length > 0 ? html`
                <button 
                  class="task-cancel-all-btn" 
                  @click=${this.cancelAllTimers}
                  title="取消全部正在运行的任务"
                  style="padding: 4px 12px; font-size: 11px;"
                >
                  全部取消
                </button>
              ` : ''}
              <button class="task-list-close" @click=${this.closeTaskList}>×</button>
            </div>
          </div>
          
          <div class="task-list-content">
            ${this._activeTimersList.length > 0 ? html`
              <table class="task-table">
                <thead>
                  <tr>
                    <th style="width: 60px;">序号</th>
                    <th>设备名</th>
                    <th style="width: 180px;">倒计时/周期</th>
                    <th style="width: 80px; text-align: center;">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${this._activeTimersList.map((timer, index) => html`
                    ${timer.is_schedule ? html`
                      <!-- 周期任务显示 -->
                      <tr style="background: rgba(0, 122, 255, 0.05);">
                        <td style="text-align: center; color: #007aff; font-weight: 500;">${index + 1}</td>
                        <td>
                          <div class="entity-info">
                            <div class="entity-name">${this.getEntityFriendlyName(timer.entity_id)}</div>
                            <div class="entity-id">${timer.entity_id}</div>
                          </div>
                        </td>
                        <td style="text-align: center;">
                          <!-- 第一行：距离下次执行倒计时 -->
                          <div class="time-display" style="font-size: 12px; color: #007aff; font-weight: 500;">
                            ${this.formatTaskTime(timer.schedule_countdown || 0)}
                          </div>
                          <!-- 第二行：周期和时间 -->
                          <div style="font-size: 10px; color: #8e8e93; margin-top: 2px;">
                            ${timer.repeat_type === 'weekly' && timer.weekdays ? 
                              `周${this.getWeekdaysText(timer.weekdays)}` : 
                              timer.repeat_type === 'monthly' && timer.month_days ? 
                              `${this.getMonthDaysText(timer.month_days)}` : 
                              this.getRepeatTypeText(timer.repeat_type)
                            } ${timer.schedule_time}
                          </div>
                          <!-- 第三行：下次执行时间 -->
                          ${timer.next_execution ? html`
                            <div style="font-size: 9px; color: #007aff; margin-top: 1px;">
                              下次 ${new Date(timer.next_execution).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' })} ${new Date(timer.next_execution).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          ` : ''}
                        </td>
                        <td>
                          <div class="task-actions" style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                            <button
                              class="task-cancel-btn"
                              @click=${() => this.cancelSpecificSchedule(timer.schedule_id)}
                              title="取消此周期任务"
                              style="width: 50px; padding: 4px 8px;"
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </tr>
                    ` : html`
                      <!-- 普通定时器显示 -->
                      <tr>
                        <td style="text-align: center; color: #8e8e93; font-weight: 500;">${index + 1}</td>
                        <td>
                          <div class="entity-info">
                            <div class="entity-name">${this.getEntityFriendlyName(timer.entity_id)}</div>
                            <div class="entity-id">${timer.entity_id}</div>
                          </div>
                        </td>
                        <td style="text-align: center;">
                          <div class="time-display">${this.formatTime(Math.floor(timer.remaining_seconds) || 0)}</div>
                          ${timer.end_time ? html`
                            <div style="font-size: 10px; color: #8e8e93; margin-top: 2px;">
                              ${this.formatEndTime(timer.end_time)}
                            </div>
                          ` : ''}
                        </td>
                        <td>
                          <div class="task-actions" style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                            <button
                              class="task-cancel-btn"
                              @click=${() => this.cancelSpecificTimer(timer.entity_id)}
                              title="取消此定时器"
                              style="width: 50px; padding: 4px 8px;"
                            >
                              取消
                            </button>
                            <button
                              class="task-modify-btn"
                              @click=${() => this.modifySpecificTimer(timer)}
                              title="修改此定时器"
                              style="width: 50px; padding: 4px 8px;"
                            >
                              修改
                            </button>
                          </div>
                        </td>
                      </tr>
                    `}
                  `)}
                </tbody>
              </table>
            ` : html`
              <div class="empty-state">
                <div class="empty-state-icon">⏰</div>
                <div class="empty-state-title">暂无任务</div>
                <div class="empty-state-subtitle">当前没有正在执行的定时任务</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

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
      
      // 刷新定时器列表
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 1000);
      
    } catch (error) {
      console.error('取消特定定时器失败:', error);
    }
  }

  async cancelAllTimers() {
    console.log('cancelAllTimers方法被调用');
    try {
      if (!this._hassReady) {
        console.error('Hass未就绪，无法取消定时器');
        return;
      }

      if ((!this._activeTimersList || this._activeTimersList.length === 0) &&
          (!this._activeSchedulesList || this._activeSchedulesList.length === 0)) {
        console.log('没有正在运行的任务可取消');
        return;
      }

      const totalTasks = (this._activeTimersList?.length || 0) + (this._activeSchedulesList?.length || 0);
      console.log('准备取消所有任务，数量:', totalTasks);

      // 逐个取消定时器，间隔0.5秒
      for (let i = 0; i < this._activeTimersList.length; i++) {
        const timer = this._activeTimersList[i];
        try {
          console.log(`取消定时器 ${i + 1}/${this._activeTimersList.length}:`, timer.entity_id);

          await this.sendEventSafe({
            action: 'cancel_entity_timer',
            entity_id: timer.entity_id,
            user_id: 'user'
          });

          console.log('取消定时器成功:', timer.entity_id);

          // 如果不是最后一个，等待0.5秒
          if (i < this._activeTimersList.length - 1 || this._activeSchedulesList.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          console.error('取消定时器失败:', timer.entity_id, error);
        }
      }

      // 逐个取消周期任务，间隔0.5秒
      for (let i = 0; i < this._activeSchedulesList.length; i++) {
        const schedule = this._activeSchedulesList[i];
        try {
          console.log(`取消周期任务 ${i + 1}/${this._activeSchedulesList.length}:`, schedule.schedule_id);

          await this.sendEventSafe({
            action: 'cancel_schedule',
            schedule_id: schedule.schedule_id,
            user_id: 'user'
          });

          console.log('取消周期任务成功:', schedule.schedule_id);

          // 如果不是最后一个，等待0.5秒
          if (i < this._activeSchedulesList.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

        } catch (error) {
          console.error('取消周期任务失败:', schedule.schedule_id, error);
        }
      }

      // 立即清除本地状态
      this._activeTimersList = [];
      this._activeSchedulesList = [];
      this._activeTimersCount = 0;
      this._timerInfo = null;
      this._timer = null;
      this._remainingSeconds = 0;
      this._progress = 100;
      this._pendingTimerRestore = false;

      console.log('本地状态已清除');

      // 刷新定时器列表
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 1000);

      // 关闭任务列表弹窗
      this.closeTaskList();

      console.log('任务列表弹窗已关闭');

    } catch (error) {
      console.error('取消全部定时器失败:', error);
    }
  }

  modifySpecificTimer(timer) {
    // 设置当前选中的实体
    this._selectedEntity = timer.entity_id;
    
    // 如果定时器有持续时间，设置到duration
    if (timer.duration) {
      this._duration = timer.duration;
    }
    
    // 关闭任务清单，打开设置界面
    this._showTaskList = false;
    this._showSettings = true;
    
    this.requestUpdate();
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
    this.requestUpdate();
    
    // 延迟执行滚动，确保DOM已更新
    setTimeout(() => {
      this.scrollToSelectedEntity();
    }, 50);
    
    // 立即刷新该实体的定时器状态
    if (this._hassReady) {
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
    this.requestUpdate();
    
    // 立即刷新该实体的定时器状态
    if (this._hassReady) {
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
      
      // 刷新状态
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
      
      // 如果定时器有剩余时间，将其设置为当前时长
      if (timer.remaining_seconds && timer.remaining_seconds > 0) {
        // 确保只处理整数秒数，去掉小数部分
        const remainingSeconds = Math.floor(timer.remaining_seconds);
        this._duration = this.secondsToDuration(remainingSeconds);
      }
      
      // 打开设置界面
      this._showSettings = true;
      this.requestUpdate();
      
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

      if (this._timerMode === 'recurring') {
        // 周期定时模式：创建周期任务
        const scheduleData = {
          action: 'create_schedule',
          entity_id: this._selectedEntity,
          repeat_type: this._recurringInterval,
          schedule_time: this._duration,  // 使用翻页钟选择的时间作为执行时间
          action_type: 'auto',
          user_id: 'user'
        };

        // 根据周期类型添加额外参数
        if (this._recurringInterval === 'weekly') {
          // 将索引转换为星期字符串
          const weekdayMap = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
          scheduleData.weekdays = this._recurringDays.map(dayIndex => weekdayMap[dayIndex]);
        } else if (this._recurringInterval === 'monthly') {
          scheduleData.month_days = this._recurringDays;
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

        await this.sendEventSafe({
          action: 'create_timer',
          entity_id: this._selectedEntity,
          duration: durationToSend,
          action_type: 'auto',
          user_id: 'user'
        });
      } else {
        // 倒计时模式
        totalSeconds = this.durationToSeconds(this._duration);
        durationToSend = this._duration;

        await this.sendEventSafe({
          action: 'create_timer',
          entity_id: this._selectedEntity,
          duration: durationToSend,
          action_type: 'auto',
          user_id: 'user'
        });
      }
      
      this._showSettings = false;
      this._totalSeconds = totalSeconds;
      
      // 刷新状态
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 1000);
      
      this.requestUpdate();
      
    } catch (error) {
      this._debugInfo = `保存设置失败: ${error.message}`;
    }
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
    
    // 添加翻页动画
    const card = this.shadowRoot?.querySelector(`.flip-clock-input[data-type="${type}"] .flip-clock-card`);
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
    
    // 添加翻页动画
    const card = this.shadowRoot?.querySelector(`.flip-clock-input[data-type="${type}"] .flip-clock-card`);
    if (card) {
      card.classList.add('flipping');
      
      // 等待动画完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 移除动画类
      card.classList.remove('flipping');
    }
  }

  // 获取可见任务列表
  getVisibleTasks(maxVisibleTasks, needsScroll) {
    if (!this._activeTimersList || this._activeTimersList.length === 0) {
      return [];
    }
    
    if (!needsScroll) {
      // 不需要滚动时，直接返回所有任务
      return this._activeTimersList;
    }
    
    // 需要滚动时，创建无缝循环的任务列表
    // 将任务列表复制多份，确保可以无缝循环
    const extendedTasks = [...this._activeTimersList, ...this._activeTimersList, ...this._activeTimersList];
    
    return extendedTasks;
  }

  // 启动连续滚动效果
  start3DAutoScroll() {
    this.stop3DAutoScroll();
    
    if (!this._activeTimersList || this._activeTimersList.length <= 1) {
      return;
    }
    
    // 计算一次显示的任务数量 - 考虑CSS padding的影响
    const heightValue = parseInt(this.config.normal_height) || 100;
    const taskHeight = 30; // 每条任务的高度
    const containerPadding = 0; // 容器内边距（已包含在CSS中）
    const availableHeight = heightValue - containerPadding;
    const maxVisibleTasks = Math.max(1, Math.floor(availableHeight / taskHeight));
    
    // 检查是否需要滚动：只有任务总数超过可见数量时才启动滚动
    const needsScroll = this._activeTimersList.length > maxVisibleTasks;
    
    if (!needsScroll) {
      // 不需要滚动时，重置滚动偏移并直接返回
      this._scrollOffset = 0;
      return;
    }
    
    // 初始化滚动偏移
    this._scrollOffset = this._scrollOffset || 0;
    
    // 计算单个任务的高度
    const originalTasksCount = this._activeTimersList.length;
    const oneCycleHeight = taskHeight * originalTasksCount; // 一个完整循环的高度
    
    // 启动连续滚动动画
    this._autoScrollInterval = setInterval(() => {
      this._scrollOffset += 0.8; // 每次向上滚动0.8像素，实现平滑滚动
      
      // 当滚动超过一个完整循环时，使用模运算实现真正的无缝循环
      if (this._scrollOffset >= oneCycleHeight) {
        // 使用模运算实现无缝循环，而不是重置到0
        this._scrollOffset = this._scrollOffset % oneCycleHeight;
      }
      
      this.requestUpdate();
    }, 30); // 每30毫秒滚动一次，实现平滑连续滚动
  }

  // 停止3D自动滚动
  stop3DAutoScroll() {
    if (this._autoScrollInterval) {
      clearInterval(this._autoScrollInterval);
      this._autoScrollInterval = null;
    }
  }

  // 启动周期任务倒计时更新
  startScheduleUpdate() {
    this.stopScheduleUpdate();
    
    // 检查是否有周期任务
    const hasSchedules = this._activeSchedulesList && this._activeSchedulesList.length > 0;
    
    if (hasSchedules) {
      // 每5秒更新一次周期任务的倒计时
      this._scheduleUpdateInterval = setInterval(() => {
        // 更新周期任务的倒计时
        if (this._activeTimersList) {
          this._activeTimersList = this._activeTimersList.map(task => {
            if (task.is_schedule) {
              return {
                ...task,
                schedule_countdown: this.calculateScheduleCountdown(task),
                schedule_info: this.formatScheduleInfo(task)
              };
            }
            return task;
          });
          this.requestUpdate();
        }
      }, 5000); // 每5秒更新一次
    }
  }

  // 停止周期任务倒计时更新
  stopScheduleUpdate() {
    if (this._scheduleUpdateInterval) {
      clearInterval(this._scheduleUpdateInterval);
      this._scheduleUpdateInterval = null;
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

      try {
        await this.sendEventSafe({
          action: 'create_timer',
          entity_id: this._selectedEntity,
          duration: this._duration,
          action_type: 'auto',
          user_id: 'user'
        });

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

      // 刷新任务列表
      setTimeout(() => {
        this.refreshTimersWithRetry();
      }, 1000);

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
    return weekdays.map(day => weekdayMap[day.toLowerCase()] || day).join('、');
  }

  // 获取月日文本
  getMonthDaysText(monthDays) {
    if (!monthDays || !Array.isArray(monthDays)) return '';
    return monthDays.map(day => `${day}日`).join('、');
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
}

// 注册自定义卡片
if (!customElements.get('timer-control-card')) {
  customElements.define('timer-control-card', TimerControlCard);
}

