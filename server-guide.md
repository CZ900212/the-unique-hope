# The Unique Hope 服务器功能指南

这份文档说明当前生产服务器上各个部分是做什么的、彼此怎么配合，以及日常最常用的操作入口。

## 1. 这台服务器现在负责什么

这台腾讯云服务器目前主要承担 4 件事：

1. 对外提供网站访问
2. 运行网站后端程序
3. 保存网站数据库
4. 负责域名和 HTTPS 证书的接入

可以把它理解成一台“网站总机房”：

- Nginx 负责接住外部访问
- Next.js 应用负责真正渲染页面和处理业务
- PostgreSQL 负责保存账号、报名、课程进度等数据
- systemd 负责把网站程序长期托管起来，自动拉起

## 2. 当前线上站点信息

- 正式域名：`uniquehopeclub.com`
- 域名跳转：`www.uniquehopeclub.com` 会跳到主域名
- 首页备案号：`浙ICP备2026020488号`
- 生产机公网 IP：`175.24.177.186`

## 3. 服务器上运行的核心组件

### 3.1 Nginx

Nginx 是外部访问进入服务器后的第一站。

它负责：

- 接收外部的 `80` / `443` 请求
- 处理 HTTPS 证书
- 把网站请求转发给本机 `3000` 端口上的 Next.js
- 处理 `www` 到主域名的跳转

它不负责：

- 账号逻辑
- 数据库读写
- 页面业务逻辑

### 3.2 Next.js 应用

这是网站真正的业务程序，项目代码就部署在这里。

它负责：

- 首页、登录页、报名页、后台页
- 管理员、教师、学生的登录流程
- API 路由
- 管理后台逻辑
- 数据导入脚本

生产目录：

- `/home/ubuntu/the-unique-hope`

### 3.3 PostgreSQL 数据库

数据库保存网站的核心数据。

它负责保存：

- 用户账号
- 管理员 / 教师 / 学生资料
- 登录凭证
- 配对信息
- 课程记录
- 反馈
- 报名数据
- 后续导入的咨询数据

### 3.4 systemd 服务

systemd 是 Linux 的服务托管器。

它负责：

- 开机自动启动网站
- 网站崩了自动重启
- 统一查看运行状态
- 统一查看程序日志

当前服务名：

- `the-unique-hope.service`

## 4. 整体访问链路

外部用户访问网站时，大致流程是：

1. 用户打开 `https://uniquehopeclub.com`
2. 腾讯云网络层把流量放进服务器
3. Nginx 接住请求
4. Nginx 把请求转发到 `127.0.0.1:3000`
5. Next.js 应用处理页面和接口
6. 如果需要数据，再访问 PostgreSQL
7. 返回页面或接口结果给用户

## 5. 当前项目代码部署位置

服务器上的项目路径：

- `/home/ubuntu/the-unique-hope`

本地项目路径：

- `/Users/admin1/Desktop/Dev/Websites/The Unique Hope`

## 6. 服务器上的主要功能模块

### 6.1 首页和公开页面

包括：

- 首页
- 学生报名页
- 成员登录页
- 管理员登录页
- 找回密码相关页面

这些页面主要负责对外展示和入口分流。

### 6.2 管理员后台

管理员后台主要负责：

- 查看报名
- 创建老师和学生账号
- 建立配对
- 管理课程进度
- 查看学生、老师数据

管理员登录入口：

- `https://uniquehopeclub.com/admin/login`

### 6.3 教师 / 学生系统

教师端主要负责：

- 查看所带学生
- 更新课程进度
- 上传课堂材料或证据

学生端主要负责：

- 查看课程记录
- 查看学习材料
- 提交反馈

### 6.4 数据导入部分

这台服务器已经额外保存了一批截图整理后的咨询数据。

当前专用表：

- `unique_hope_student_inquiry`

这个表专门存储：

- 来源序号
- 提交时间
- IP
- 地区
- 渠道
- 学生姓名
- 性别
- 学校
- 年级
- 英语成绩说明

## 7. 账号体系怎么工作的

系统里账号不是“随便一个邮箱加密码”这么简单，而是分角色的。

支持的角色有：

- admin
- teacher
- student

一个能正常登录的账号，至少要同时具备：

- 用户记录
- 角色资料
- 密码哈希

所以不要直接手工只改某一张表，否则可能出现：

- 邮箱存在但不能登录
- 用户存在但后台看不到
- 角色不匹配导致登录失败

## 8. 目前已经确认可用的关键项目

### 8.1 已经可用

- 正式 HTTPS 访问
- 首页备案号展示
- 管理员后台访问入口
- 数据库在线
- 导入数据已落库
- 新创建的 3 个 admin 账号已写入数据库

### 8.2 最近处理过的内容

- 把生产域名统一成 `uniquehopeclub.com`
- 修复 443 外部访问
- 给首页挂上备案号
- 新建学生咨询数据表
- 导入 32 条咨询数据
- 新建 3 个新的 admin 账号

## 9. 常用登录和管理入口

### 9.1 网站地址

- 首页：`https://uniquehopeclub.com`
- 管理员登录：`https://uniquehopeclub.com/admin/login`

### 9.2 SSH 登录

常用 SSH 命令：

```bash
ssh -i "/Users/admin1/Desktop/Dev/Websites/The Unique Hope/key/Mar18th.pem" ubuntu@175.24.177.186
```

项目内密钥目录：

- `/Users/admin1/Desktop/Dev/Websites/The Unique Hope/key`

## 10. 服务器上最常用的几条命令

### 查看网站服务状态

```bash
sudo systemctl status the-unique-hope.service
```

### 重启网站服务

```bash
sudo systemctl restart the-unique-hope.service
```

### 查看网站日志

```bash
sudo journalctl -u the-unique-hope.service -n 100 --no-pager
```

### 查看 Nginx 状态

```bash
sudo systemctl status nginx
```

### 重启 Nginx

```bash
sudo systemctl restart nginx
```

### 查看 Nginx 配置

```bash
sudo nginx -T
```

### 查看数据库服务

```bash
sudo systemctl status postgresql
```

## 11. 遇到问题先看哪里

### 11.1 网站打不开

先分清是哪一层坏了：

- 域名不通
- 443 不通
- Nginx 异常
- 应用异常
- 数据库异常

建议顺序：

1. 先看域名能不能打开
2. 再看 Nginx 状态
3. 再看 `the-unique-hope.service`
4. 最后看数据库

### 11.2 网站能打开，但后台登录不了

优先检查：

- 账号是否真的存在
- 角色是不是 `admin`
- 密码是否已经重置
- 是否登录到了错误入口

### 11.3 SSH 登不上

优先检查：

- 轻量云防火墙是否放通 `22`
- 服务器内 `ssh` 服务是否正常
- 腾讯云控制台网页登录是否正常
- 密钥路径和权限是否正确

## 12. 当前需要特别注意的事

### 12.1 不要随便删数据库表

因为账号体系、课程记录和导入数据都依赖数据库。  
随便删表会让系统直接坏掉。

### 12.2 不要把密钥提交进 Git

项目里的 `key/` 目录已经加进 `.gitignore`。  
`project.md` 也已经加进 `.gitignore`。

### 12.3 账号变更要谨慎

管理员账号如果删错，可能会把自己锁在外面。  
删除旧 admin 之前，最好先确认新的 admin 能真实登录。

## 13. 现在这台服务器的大致职责总结

如果用一句话总结：

这台服务器现在就是 The Unique Hope 的完整生产环境，负责网站访问、后台管理、数据库存储、HTTPS 接入和运维托管。

如果以后换人接手，先读这份文档，再看：

- `project.md`
- 项目根目录的代码
- 服务器上的 `systemd`、Nginx 和 PostgreSQL 状态
