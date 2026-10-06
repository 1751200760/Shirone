import fs from "node:fs";
import path from "node:path";

// 百度准入密钥与站点配置（必须与百度站长平台绑定的精确主域一致：https://www.aigene.studio）
const TOKEN = process.env.BAIDU_PUSH_TOKEN || "gI9DXYJyXPJPzIV5";
const TARGET_SITE = process.env.BAIDU_PUSH_SITE || "https://www.aigene.studio";

// 尝试从 sitemap 中读取整站页面
const sitemapPaths = [
	path.resolve("dist/sitemap.xml"),
	path.resolve("public/sitemap.xml"),
	path.resolve("dist/sitemap-0.xml"),
];

let rawXml = "";
for (const p of sitemapPaths) {
	if (fs.existsSync(p)) {
		rawXml = fs.readFileSync(p, "utf8");
		break;
	}
}

if (!rawXml) {
	console.error(
		"[baidu-push] 错误: 未找到 sitemap.xml 文件，请先执行 build 或检查 public/sitemap.xml",
	);
	process.exit(1);
}

const locMatches = [...rawXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) =>
	m[1].trim(),
);
const uniqueUrls = Array.from(new Set(locMatches)).filter(Boolean);

if (uniqueUrls.length === 0) {
	console.error("[baidu-push] 错误: sitemap.xml 中未解析到有效 URL");
	process.exit(1);
}

// 确保所有 URL 统一为百度站长平台绑定的域名
const targetOrigin = new URL(TARGET_SITE).origin;
const formattedUrls = uniqueUrls.map((u) => {
	try {
		const parsed = new URL(u);
		return `${targetOrigin}${parsed.pathname}${parsed.search}`;
	} catch {
		return u;
	}
});

// 优先级排序：首页 > 文章页 > 系列 > 关于/归档 > 其它
formattedUrls.sort((a, b) => {
	const getPriority = (urlStr) => {
		if (urlStr === `${targetOrigin}/`) return 100;
		if (urlStr.includes("/posts/")) return 90;
		if (urlStr.includes("/series/")) return 80;
		if (urlStr.includes("/about/")) return 70;
		if (urlStr.includes("/archive/")) return 60;
		return 10;
	};
	return getPriority(b) - getPriority(a);
});

// 输出本地 urls.txt
const urlsTxtPath = path.resolve("urls.txt");
fs.writeFileSync(urlsTxtPath, formattedUrls.join("\n"), "utf8");
console.log(
	`[baidu-push] 提取到 ${formattedUrls.length} 条 URL，已按权重排序写入 urls.txt。`,
);

const apiUrl = `http://data.zz.baidu.com/urls?site=${TARGET_SITE}&token=${TOKEN}`;

async function sendUrls(urlsToSend) {
	const response = await fetch(apiUrl, {
		method: "POST",
		headers: {
			"Content-Type": "text/plain",
		},
		body: urlsToSend.join("\n"),
	});
	const resText = await response.text();
	let data;
	try {
		data = JSON.parse(resText);
	} catch {
		data = { raw: resText };
	}
	return { ok: response.ok, status: response.status, data };
}

// 智能推送策略：
// 百度如果提交 URL 数量 > 当日剩余配额（remain），会返回 400 over quota 且完全不收录。
// 因此如果 over quota，我们自动递减条数，直到将今日配额完全用满。
async function run() {
	let currentBatch = [...formattedUrls];
	while (currentBatch.length > 0) {
		console.log(
			`[baidu-push] 尝试提交高优先级的前 ${currentBatch.length} 条 URL...`,
		);
		const { ok, data } = await sendUrls(currentBatch);

		if (ok && data.success !== undefined) {
			console.log("\n==========================================");
			console.log("🎉 百度推送成功！");
			console.log(`✅ 本次成功推送 URL: ${data.success} 条`);
			console.log(`📊 今日剩余可用配额: ${data.remain} 条`);
			console.log("📄 已成功推送的链接列表:");
			for (const u of currentBatch) {
				console.log(`   + ${u}`);
			}
			if (data.not_same_site && data.not_same_site.length > 0) {
				console.warn(
					`⚠️ 非本站 URL（未处理）: ${data.not_same_site.join(", ")}`,
				);
			}
			console.log("==========================================\n");
			return;
		}

		if (data.message === "over quota") {
			console.warn(
				`[baidu-push] 提示: 提交数量(${currentBatch.length})超出当日剩余配额，自动缩减条数重试...`,
			);
			if (currentBatch.length > 8) {
				currentBatch = currentBatch.slice(0, 8);
			} else if (currentBatch.length > 4) {
				currentBatch = currentBatch.slice(0, 4);
			} else if (currentBatch.length > 2) {
				currentBatch = currentBatch.slice(0, 2);
			} else if (currentBatch.length > 1) {
				currentBatch = currentBatch.slice(0, 1);
			} else {
				console.error("[baidu-push] 今日配额已耗尽 (0 条)，请明天再试！");
				return;
			}
		} else {
			console.error("[baidu-push] 百度接口返回未知错误:", data);
			process.exit(1);
		}
	}
}

run().catch((err) => {
	console.error("[baidu-push] 发生异常:", err);
	process.exit(1);
});
