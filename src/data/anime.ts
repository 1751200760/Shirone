import type { AnimeIdentity } from "../types/animeConfig.ts";

/** 收藏状态（Bangumi 领域通行五态） */
export type AnimeStatus =
	| "watching"
	| "completed"
	| "planned"
	| "onHold"
	| "dropped";

export interface AnimeItem {
	title: string;
	/** 封面图地址（相对 /public 或绝对 URL）；省略 = 渐变占位 */
	cover?: string;
	/** 条目外链（Bangumi/官方站等）；省略则封面不可点 */
	link?: string;
	status: AnimeStatus;
	/** 个人评分 0-10 */
	rating: number;
	/** 追番进度：已看 / 总集数（未知时可选省略） */
	progress?: { watched: number; total: number };
	/** 一句话感想 */
	description?: string;
	/** 放送年份（展示用） */
	year: string;
	/** 制作公司 */
	studio?: string;
	/** 题材标签 */
	genres: string[];
	/** 观看时间段（年-月） */
	period?: { start: string; end: string };
	/** 条目来源身份标识（可选，用于跨源去重与归档） */
	identity?: AnimeIdentity;
}

export const animeData: AnimeItem[] = [
	{
		title: "葬送的芙莉莲",
		cover: "https://i0.hdslb.com/bfs/bangumi/image/d36a3f65cd6ff8ef6d5a1bdae6b98754b2d3587b.png",
		link: "https://www.bilibili.com/bangumi/media/md28237110",
		status: "completed",
		rating: 9.8,
		progress: { watched: 28, total: 28 },
		description: "在漫长岁月中探寻人心的旅程，温柔而深刻的史诗。",
		year: "2023",
		studio: "Madhouse",
		genres: ["奇幻", "冒险", "治愈"],
		period: { start: "2023-09", end: "2024-03" },
	},
	{
		title: "Overlord (骨王)",
		cover: "https://i0.hdslb.com/bfs/bangumi/image/1f47f2ef8c13010b14c1d81b9e287040409a69ad.png",
		link: "https://www.bilibili.com/bangumi/media/md2576",
		status: "completed",
		rating: 9.3,
		progress: { watched: 13, total: 13 },
		description: "吾乃安兹·乌尔·恭，与空气斗智斗勇的异界征服之旅！",
		year: "2015",
		studio: "Madhouse",
		genres: ["奇幻", "穿越", "战斗"],
		period: { start: "2015-07", end: "2015-09" },
	},
];
