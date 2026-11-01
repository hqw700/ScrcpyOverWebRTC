# ScrcpyOverWebRTC (穿云投屏) Release Notes - v0.4.3

发布日期 / Release date: 2026-11-01

## v0.4.3 紧急修复说明

由于早期测试版本的疏漏，Agent 内置的测试到期日期（2026-11-01）未及时移除，导致旧版本无法启动或自动退出。v0.4.3 已移除默认到期限制，对造成的不便深表歉意。

### 旧版本处理方案

建议升级至 **v0.4.3 并重新部署设备端 Agent**。暂时无法升级的用户可按以下方式恢复：

- **脚本部署**：编辑 `run.sh` / `run.bat`，将启动命令中的 `env GODEBUG=asyncpreemptoff=1` 替换为 `env GODEBUG=asyncpreemptoff=1 CP_AGENT_EXPIRES_AT=2099-01-01`，然后重新运行脚本。
- **Magisk / KernelSU**：在 `/data/adb/modules/cloudphone-agent/config.conf` 末尾加入 `export CP_AGENT_EXPIRES_AT="2099-01-01"`，执行 `cpctl restart` 或重启设备。

注意：仅更新服务端无效；旧版部署脚本不支持直接追加 `-expires-at` 参数。

---

## v0.4.3 Emergency Hotfix

Due to an oversight in an early test version, the Agent’s test expiration date (November 1, 2026) was left in place, preventing older Agents from starting or causing them to exit automatically. v0.4.3 removes the default expiration. We apologize for the disruption.

### Workaround for Older Versions

**Upgrade to v0.4.3 and redeploy the device-side Agent.** If you cannot upgrade immediately:

- **Script deployment:** In `run.sh` / `run.bat`, replace `env GODEBUG=asyncpreemptoff=1` with `env GODEBUG=asyncpreemptoff=1 CP_AGENT_EXPIRES_AT=2099-01-01`, then rerun the script.
- **Magisk / KernelSU:** Append `export CP_AGENT_EXPIRES_AT="2099-01-01"` to `/data/adb/modules/cloudphone-agent/config.conf`, then run `cpctl restart` or reboot the device.

Note: Updating the server alone does not resolve this issue. Older deployment scripts do not forward the `-expires-at` option.

---

## 发布包与下载 / Assets & Downloads

| 发布包 / Package | 版本 / Version | 下载 / Download | 提取与解压 / Access & Extraction |
| :--- | :--- | :--- | :--- |
| 全套管理平台 / Platform bundle (`cloudphone-v0.4.3-netdisk.zip`) | v0.4.3 | [夸克网盘 / Quark](https://pan.quark.cn/s/8d1fa2582cc1) | 免密；按内附说明将 `.bin` 改为 `.zip` 后解压 / No password; rename the inner `.bin` to `.zip` before extraction |
| Magisk / KernelSU / APatch (`cloudphone-agent-magisk-v0.4.3.zip`) | v0.4.3 | [夸克网盘 / Quark](https://pan.quark.cn/s/c2fb80b237a1) | 免密 / No password |
| Android App（本次未更新 / unchanged） | v0.4.2 | [WebrtcPhone-Android](https://github.com/hqw700/WebrtcPhone-Android) | 独立开源项目 / Separate open-source project |

## 官方文档与资源 / Documentation & Resources

- [旧版本恢复指南 / Recovery guide](https://webrtc-phone.com/docs/agent-expiration-fix.html) · [English](https://webrtc-phone.com/docs/en/agent-expiration-fix.html)
- [官方技术文档 / Documentation](https://webrtc-phone.com/docs/)
- [GitHub Release](https://github.com/hqw700/ScrcpyOverWebRTC/releases/tag/v0.4.3)
- [前端开源仓库 / Frontend repository](https://github.com/hqw700/ScrcpyOverWebRTC)
- [PVE 原生运行环境 / PVE runtime](https://github.com/hqw700/redroid-pve)
- Docker: `docker pull buutuu/scrcpy-over-webrtc:latest`（已有设备仍需更新 Agent / existing devices still require an Agent update）
