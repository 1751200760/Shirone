import type { AnnouncementConfig } from "@/types/announcementConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 公告栏配置
 * 组件显示由 sidebarConfig 统一控制
 */
export const announcementConfig: AnnouncementConfig = withUserConfig(
	"announcement",
	{
		title: "站点公告",
		content: "欢迎来到蓝莓小屋！小站全新改版上线，支持动态 M3E 配色与丰富音乐播放～",
		closable: true,
		link: {
			enable: true,
			text: "查看详情",
			url: "/posts/hello-world/",
			external: false,
		},
	},
);
