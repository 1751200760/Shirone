/**
 * 时间线页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/timelineConfig.ts 控制。
 */
import type { TimelineItem } from "@/types/timelineConfig";

export const timelineData: TimelineItem[] = [
	{
		title: "Blueberry 个人小站正式建立",
		date: "2026-10-04",
		category: "milestone",
		subtitle: "全新起点",
		description:
			"Blueberry 的个人博客今天正式搭建完成并上线！基于 Shirone 主题与现代 Web 前端技术栈构建，开启记录技术与生活的新篇章。",
		highlights: [
			"完成博客本地环境配置与定制化开发",
			"接入个性化二次元设计、M3E 主题色与番剧清单",
			"发布第一篇博客文章《启程：博客建站简介与致谢》",
		],
		tags: ["建站", "Blueberry", "Shirone", "Astro"],
		links: [
			{
				label: "GitHub 仓库",
				url: "https://github.com/1751200760/Shirone",
				icon: "fa6-brands:github",
			},
		],
		icon: "material-symbols:rocket-launch-rounded",
		featured: true,
	},
];

/** 获取所有时间线数据列表 */
export function getTimelineList(): TimelineItem[] {
	return timelineData;
}
