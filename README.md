# Timer Control Card - Home Assistant 定时器集成

## 一、 项目背景与动机

**智者造物，以简驭繁。**  
智能家居之定时，乃日用常需。然传统之法，操作繁复，界面难明，功能单一，移动不便。  

**尤以设备管理为患：**  
- 灯、扇、空调、媒体，各立门户，操作不一  
- 定时任务，散落四方，难以统辖  
- 周期任务，配置繁琐，管理维艰  

**吾辈制此卡片，旨在化繁为简：**  
- 翻页钟表，一目了然  
- 设备分类，择之便捷  
- 周期定时，省心省力  
- 空调智能，冷暖自知  
- 响应设计，大小皆宜  
- **总揽全局，定时皆归一处**

**工具之妙，在于简朴。集中管理，方显智慧。**  

---

## 二、 功能特性

### 🕒 功能
- **倒计时定时器**：为设备设置倒计时定时任务
- **周期定时任务**：支持每日、每周、每月周期定时
- **空调智能控制**：自动保存和恢复空调状态，支持温度、模式设置
- **多设备支持**：灯光、开关、媒体播放器、风扇、空调、窗帘
- **自动重连机制**：网络异常时自动恢复连接
- **状态持久化**：重启后自动恢复定时任务
- **两种显示模式**：Mini（紧凑）和 Normal（完整）
- **响应式设计**：完美适配桌面端和移动端
- **翻页钟控件**：优雅的时间输入界面
- **设备分类选择**：按设备类型智能分类
- **搜索功能**：快速查找设备
- **进度条显示**：实时显示定时器进度

### 🎨 界面特色
## 📸 界面预览

<div style="display: flex; justify-content: space-around; align-items: center; flex-wrap: wrap;">
  <img src="https://github.com/chjspp520/timer-control-card/blob/main/%E4%B8%89%E7%A7%8DUI%E7%95%8C%E9%9D%A2.png" alt="截图" style="width: 100%; height: auto; margin: 5px;">
  <img src="https://github.com/chjspp520/timer-control-card/blob/main/%E4%BB%BB%E5%8A%A1%E4%B8%AD%E5%BF%83.png" alt="截图" style="width: 100%; height: auto; margin: 5px;">
  <img src="https://github.com/chjspp520/timer-control-card/blob/main/%E6%BC%94%E7%A4%BA%E5%8A%A8%E7%94%BB.gif" alt="截图" style="width: 100%; height: auto; margin: 5px;">

---
## 三、 安装方法
### 1、集成安装  
####  方法一：通过 HACS 安装（推荐）
> 确保已安装 HACS。  
> 在 HACS 的「集成」页面中，点击右上角的「⋮」按钮，选择「自定义存储库」。  
> 输入以下信息：  
> 存储库: https://github.com/chjspp520/timer-control-card  
> 类别: 集成    
> 点击「添加」。  
> 在 HACS 的「集成」页面中搜索 timer-control-card，然后点击「下载」。   
> 下载完成后，重启 Home Assistant。  
*** 
####  方法二：手动安装
> 下载集成文件：   
> 从 GitHub 发布页面 下载最新版本的 .zip 文件。    
> 解压文件，将 custom_components/timer_backend 文件夹复制到您的 Home Assistant 的 custom_components 目录中。   
> 如果 custom_components 目录不存在，请手动创建。   
> 重启 Home Assistant。   
*** 
### 2、卡片配置
任务中心配置代码，支持自动主题：  
主题可以是文本、也可以从实体处获取，支持跟随设备、根据时间  
主题名称，直接填写名称也可以，如果要使用实体，请使用下拉型实体，实体值设置为light、dark、black、darkgray、transparent、phone、time：  
  light：亮色  
  dark：暗色  
  black：纯黑  
  darkgray：深灰  
  transparent：半透明     
  dark_light_theme: 当theme为time/phone时，暗色和亮色对应的主题
```yaml
        type: custom:timer-control-card
        theme: input_select.theme
        dark_light_theme: dark,light
        show_buttons: false
        card_style: normal
        normal_height: 150px
        time_box_progress_background: "#a8c97f"
```
---

## 四、 api使用方法：

> 1、调用api需要使用长期token，建立方法：  
          获取Token路径：Home Assistant → 用户配置 → 安全 → 长期访问令牌 → 创建令牌  
> 2、创建定时器：  

```yaml
curl -X POST "http://localhost:8123/api/timer_backend" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_timer",
    "entity_id": "input_boolean.ce_shi",
    "duration": "00:05:00",
    "action_type": "auto"
  }'
参数说明：    

参数                      说明    
duration           倒计时时长，格式 HH:MM:SS    
action_type        auto(自动判断)、turn_on、turn_off    
```

> 3、创建周期定时器：  

```yaml
curl -X POST "http://localhost:8123/api/timer_backend" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_schedule",
    "entity_id": "input_boolean.ce_shi",
    "repeat_type": "daily",
    "schedule_time": "08:30:00",
    "action_type": "turn_on"
  }'
周期类型 (repeat_type)：

daily - 每天
weekly - 每周（需配合 weekdays）
monthly - 每月（需配合 month_days）
每周示例（周一到周五）：
```
>  4、查询任务：

```yaml
查询指定实体的任务：

curl -X GET "http://localhost:8123/api/timer_backend?entity_id=input_boolean.ce_shi" \
  -H "Authorization: Bearer YOUR_TOKEN"

查询所有任务：
curl -X GET "http://localhost:8123/api/timer_backend" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
>  5、取消任务：

```yaml
取消指定实体的所有任务：
curl -X DELETE "http://localhost:8123/api/timer_backend" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id": "input_boolean.ce_shi"}'
```


# 定时器卡片需要和定时器集成配合使用，单独无法使用！
