/**
 * 友情链接数据配置（结构与 Mizuki 同款，并扩展二态支持与截图字段）
 */
export type FriendState = "normal" | "owner" | "featured";

export interface FriendItem {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
	/** 特殊状态：owner 站长紫 | featured 推荐金 */
	state?: FriendState;
	/** 站点悬浮截图预览地址（可选） */
	siteshot?: string;
}

// 友情链接数据
export const friendsData: FriendItem[] = [
	{
		id: 1,
		title: "蓝莓小屋 (本站)",
		imgurl: "/logo/icon.webp",
		desc: "向着光前行，不负每一次相遇与热爱。",
		siteurl: "https://aigene.studio/",
		tags: ["站长", "博客"],
		state: "owner",
	},
	{
		id: 2,
		title: "Shirone (白音)",
		imgurl: "https://avatars.githubusercontent.com/u/1751200760?v=4",
		desc: "Material 3 Expressive 风格的二次元 Astro 博客主题",
		siteurl: "https://github.com/1751200760/Shirone",
		tags: ["推荐", "Theme", "Astro"],
		state: "featured",
	},
	{
		id: 3,
		title: "番茄主理人",
		imgurl: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		desc: "躬身入局，心为主理，行有尺度，自持本心。",
		siteurl: "https://blog.fqzlr.top/",
		tags: ["博客", "折腾", "友链"],
	},
	{
		id: 4,
		title: "Mizuki",
		imgurl: "https://avatars.githubusercontent.com/u/225602409?v=4&s=640",
		desc: "Another Fuwari-based blog theme with docs",
		siteurl: "https://mizuki.mysqil.com",
		tags: ["Blog", "Theme"],
	},
	{
		id: 5,
		title: "Astro",
		imgurl: "https://avatars.githubusercontent.com/u/44914786?v=4&s=640",
		desc: "The web framework for content-driven websites",
		siteurl: "https://astro.build",
		tags: ["Framework"],
	},
	{
		id: 6,
		title: "Material 3",
		imgurl: "https://avatars.githubusercontent.com/u/19478152?v=4&s=640",
		desc: "Material Design 3 — the next generation of Material Design",
		siteurl: "https://m3.material.io",
		tags: ["Design"],
	},
];

export function getFriendsList(): FriendItem[] {
	return friendsData;
}

export function getShuffledFriendsList(): FriendItem[] {
	const shuffled = [...friendsData];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
