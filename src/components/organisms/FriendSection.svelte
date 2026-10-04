<script lang="ts">
import Chips from "@components/atoms/action/Chips.svelte";
import Card from "@components/atoms/display/Card.svelte";
import LoadingIndicator from "@components/atoms/feedback/LoadingIndicator.svelte";
import TextField from "@components/atoms/input/TextField.svelte";
import FriendCard from "@components/molecules/FriendCard.svelte";
import PageHeader from "@components/molecules/PageHeader.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import type { FriendItem } from "../../data/friends";

let {
	friends = [] as FriendItem[],
	title = i18n(I18nKey.friends),
	subtitle = i18n(I18nKey.friendsBanner),
}: {
	friends?: FriendItem[];
	title?: string;
	subtitle?: string;
} = $props();

let query = $state("");
let selectedTag = $state("");
let initialized = false;

type FilterPhase = "idle" | "loading" | "out";
let phase = $state<FilterPhase>("idle");
let phaseTimers: ReturnType<typeof setTimeout>[] = [];

/**
 * 死链检测与状态管理
 * 状态枚举: success | slow | warn | timeout
 * 缓存键: shirone:friend-check-result
 * failCount:
 *   0 -> 活跃区 (active)
 *   1-6 -> 暂存区 (pendingZone)
 *   >= 7 -> 墓碑墙 (graveyardZone)
 */
interface CheckRecord {
	status: "success" | "slow" | "warn" | "timeout";
	failCount: number;
	lastChecked: number;
}

const STORAGE_KEY = "shirone:friend-check-result";
let checkCache = $state<Record<string, CheckRecord>>({});

// 悬浮站点预览 Portal 相关状态
let previewFriend = $state<FriendItem | null>(null);
let previewPosition = $state<{ x: number; y: number } | null>(null);
let previewPortalEl: HTMLDivElement | null = null;

const tagItems = $derived(
	Array.from(new Set(friends.flatMap((friend) => friend.tags)))
		.sort((a, b) => a.localeCompare(b))
		.map((tag) => ({ value: tag, label: tag })),
);

const filtered = $derived.by(() => {
	const normalizedQuery = query.trim().toLowerCase();

	return friends.filter((friend) => {
		if (selectedTag && !friend.tags.includes(selectedTag)) return false;
		if (!normalizedQuery) return true;

		let searchableHost = friend.siteurl;
		try {
			searchableHost = new URL(friend.siteurl).hostname;
		} catch {
			/* Keep original URL */
		}

		return [friend.title, friend.desc, searchableHost, ...friend.tags].some(
			(value) => value.toLowerCase().includes(normalizedQuery),
		);
	});
});

// 三区划分
const activeFriends = $derived(
	filtered.filter((friend) => {
		const rec = checkCache[friend.siteurl];
		return !rec || rec.failCount < 1;
	}),
);

const pendingFriends = $derived(
	filtered.filter((friend) => {
		const rec = checkCache[friend.siteurl];
		return rec && rec.failCount >= 1 && rec.failCount < 7;
	}),
);

const graveyardFriends = $derived(
	filtered.filter((friend) => {
		const rec = checkCache[friend.siteurl];
		return rec && rec.failCount >= 7;
	}),
);

const visibleCount = $derived(filtered.length);

function countLabel(count: number) {
	return `${count} ${i18n(count === 1 ? I18nKey.friendsCount : I18nKey.friendsCounts)}`;
}

function onTagChange() {
	phaseTimers.forEach(clearTimeout);
	phase = "loading";
	phaseTimers = [
		setTimeout(() => (phase = "out"), 300),
		setTimeout(() => (phase = "idle"), 300 + 150),
	];
}

// 站点探活逻辑 (用 no-cors fetch 或 image ping)
async function probeUrl(url: string): Promise<{ ok: boolean; duration: number }> {
	const start = performance.now();
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 6000);

	try {
		await fetch(url, {
			method: "HEAD",
			mode: "no-cors",
			cache: "no-store",
			signal: controller.signal,
		});
		clearTimeout(timer);
		const duration = Math.round(performance.now() - start);
		return { ok: true, duration };
	} catch {
		clearTimeout(timer);
		// fallback 用 Image 探活 favicon
		return new Promise((resolve) => {
			const img = new Image();
			const imgTimer = setTimeout(() => {
				img.src = "";
				resolve({ ok: false, duration: 6000 });
			}, 4000);

			img.onload = () => {
				clearTimeout(imgTimer);
				resolve({ ok: true, duration: Math.round(performance.now() - start) });
			};
			img.onerror = () => {
				clearTimeout(imgTimer);
				// CORS 限制可能导致 onerror，但在很多场景算连接上了，仍视情况判断
				resolve({ ok: false, duration: Math.round(performance.now() - start) });
			};
			try {
				const u = new URL(url);
				img.src = `${u.origin}/favicon.ico?_t=${Date.now()}`;
			} catch {
				resolve({ ok: false, duration: 6000 });
			}
		});
	}
}

// 批量后台探活
async function runHealthCheck() {
	const updated = { ...checkCache };
	let hasChanges = false;
	const now = Date.now();

	for (const friend of friends) {
		const existing = updated[friend.siteurl];
		// 12小时内检查过的跳过后台重新探活
		if (existing && now - existing.lastChecked < 12 * 60 * 60 * 1000) {
			continue;
		}

		try {
			const { ok, duration } = await probeUrl(friend.siteurl);
			let status: "success" | "slow" | "warn" | "timeout" = "success";
			let failCount = existing ? existing.failCount : 0;

			if (!ok) {
				failCount += 1;
				status = failCount >= 7 ? "timeout" : "warn";
			} else {
				failCount = 0;
				status = duration > 2500 ? "slow" : "success";
			}

			updated[friend.siteurl] = {
				status,
				failCount,
				lastChecked: now,
			};
			hasChanges = true;
		} catch {
			// ignore probe error
		}
	}

	if (hasChanges) {
		checkCache = updated;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
		} catch {
			/* localStorage might be disabled */
		}
	}
}

// Hover 预览与 portalToBody
function handleCardHover(e: MouseEvent, friend: FriendItem) {
	const target = e.currentTarget as HTMLElement;
	if (!target) return;
	const rect = target.getBoundingClientRect();

	// 浮层尺寸大致 280 x 180
	const previewWidth = 280;
	const previewHeight = 180;

	let x = rect.left + rect.width / 2 - previewWidth / 2;
	let y = rect.top - previewHeight - 12;

	// 视口边界碰撞检测
	if (x < 12) x = 12;
	if (x + previewWidth > window.innerWidth - 12) {
		x = window.innerWidth - previewWidth - 12;
	}
	if (y < 12) {
		// 顶部放不下就放到卡片下方
		y = rect.bottom + 12;
	}

	previewFriend = friend;
	previewPosition = { x, y };
}

function handleCardLeave() {
	previewFriend = null;
	previewPosition = null;
}

$effect(() => {
	const q = query;
	const t = selectedTag;
	if (!initialized) return;
	const params = new URLSearchParams(window.location.search);
	params.delete("q");
	params.delete("tag");
	if (q) params.set("q", q);
	if (t) params.set("tag", t);
	const qs = params.toString();
	history.replaceState(
		history.state,
		"",
		qs ? `?${qs}` : window.location.pathname,
	);
});

// Portal 浮层渲染与挂载到 document.body
$effect(() => {
	if (!previewPortalEl && typeof document !== "undefined") {
		previewPortalEl = document.createElement("div");
		previewPortalEl.className = "friend-portal-preview-root";
		document.body.appendChild(previewPortalEl);
	}

	if (previewPortalEl) {
		if (previewFriend && previewPosition) {
			const siteshotUrl =
				previewFriend.siteshot ||
				`https://api.microlink.io/?url=${encodeURIComponent(previewFriend.siteurl)}&screenshot=true&meta=false&embed=screenshot.url`;

			previewPortalEl.style.display = "block";
			previewPortalEl.style.left = `${previewPosition.x}px`;
			previewPortalEl.style.top = `${previewPosition.y}px`;
			previewPortalEl.innerHTML = `
				<div class="friend-portal-preview-card">
					<div class="friend-portal-preview-img-wrap">
						<img src="${siteshotUrl}" alt="${previewFriend.title}" class="friend-portal-preview-img" loading="lazy" onerror="this.parentElement.classList.add('is-fallback')" />
						<div class="friend-portal-preview-fallback">
							<span>${previewFriend.title}</span>
						</div>
					</div>
					<div class="friend-portal-preview-info">
						<span class="friend-portal-preview-title">${previewFriend.title}</span>
						<span class="friend-portal-preview-url">${previewFriend.siteurl}</span>
					</div>
				</div>
			`;
		} else {
			previewPortalEl.style.display = "none";
		}
	}
});

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	query = params.get("q") || "";
	selectedTag = params.get("tag") || "";
	initialized = true;

	// 读取 localStorage 缓存
	try {
		const cached = localStorage.getItem(STORAGE_KEY);
		if (cached) {
			checkCache = JSON.parse(cached);
		}
	} catch {
		/* localStorage might be empty or disabled */
	}

	// 延迟后台探活，不阻塞初次渲染
	const probeTimer = setTimeout(() => {
		runHealthCheck();
	}, 1200);

	return () => {
		phaseTimers.forEach(clearTimeout);
		clearTimeout(probeTimer);
		if (previewPortalEl && previewPortalEl.parentNode) {
			previewPortalEl.parentNode.removeChild(previewPortalEl);
		}
	};
});
</script>

<Card color="var(--card-bg)" radius="l" class="friend-section px-8 py-6">
	<PageHeader
		icon="material-symbols:handshake-outline-rounded"
		{title}
		{subtitle}
	/>

	{#if friends.length > 0}
		<div class="friend-section__tools">
			<div class="friend-section__search">
				<TextField
					type="search"
					bind:value={query}
					placeholder={i18n(I18nKey.search)}
					label={i18n(I18nKey.search)}
					hideLabel
					variant="outlined"
					class="!rounded-(--shape-corner-l)"
				>
					<Icon slot="leading" icon="material-symbols:search-rounded" aria-hidden="true" />
				</TextField>
				{#if query}
					<button
						type="button"
						class="friend-section__search-clear"
						aria-label={i18n(I18nKey.clear)}
						onclick={() => (query = "")}
					>
						<Icon icon="material-symbols:close-rounded" aria-hidden="true" />
					</button>
				{/if}
			</div>

			{#if tagItems.length > 0}
				<div class="friend-section__chips">
					<Chips
						items={tagItems}
						variant="filter"
						bind:value={selectedTag}
						onchange={onTagChange}
					/>
				</div>
			{/if}
			<p class="friend-section__count">{countLabel(visibleCount)}</p>
		</div>
	{/if}

	{#if phase !== "idle"}
		<div
			class="friend-section__loading"
			class:friend-section__loading--out={phase === "out"}
		>
			<LoadingIndicator contained size={64} />
		</div>
	{:else if filtered.length > 0}
		{#key `${query}|${selectedTag}`}
			<div class="friend-section__zones">
				<!-- 活跃区 -->
				{#if activeFriends.length > 0}
					<div class="friend-section__zone">
						<div class="friend-section__list">
							{#each activeFriends as friend (friend.id)}
								<FriendCard
									{friend}
									status={checkCache[friend.siteurl]?.status ?? "success"}
									onhover={handleCardHover}
									onleave={handleCardLeave}
								/>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 暂存区 pendingZone (失联 1-6 次) -->
				{#if pendingFriends.length > 0}
					<div class="friend-section__zone friend-section__zone--pending">
						<div class="friend-section__zone-header">
							<Icon icon="material-symbols:wifi-off-rounded" class="friend-section__zone-icon" />
							<div class="friend-section__zone-titles">
								<h3 class="friend-section__zone-title">暂存区 (连接波动)</h3>
								<span class="friend-section__zone-desc">对方站点暂时失联或抽风（累计异常 1~6 次），正在持续重试观测中</span>
							</div>
							<span class="friend-section__zone-badge">{pendingFriends.length}</span>
						</div>
						<div class="friend-section__list">
							{#each pendingFriends as friend (friend.id)}
								<FriendCard
									{friend}
									status={checkCache[friend.siteurl]?.status ?? "warn"}
									onhover={handleCardHover}
									onleave={handleCardLeave}
								/>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 墓碑墙 graveyardZone (失联 >= 7 次) -->
				{#if graveyardFriends.length > 0}
					<div class="friend-section__zone friend-section__zone--graveyard">
						<div class="friend-section__zone-header">
							<Icon icon="material-symbols:local-florist-rounded" class="friend-section__zone-icon text-[#9e9e9e]" />
							<div class="friend-section__zone-titles">
								<h3 class="friend-section__zone-title">墓碑墙 (已失联)</h3>
								<span class="friend-section__zone-desc">失联超 7 次未能复苏的伙伴站点，留此纪念，感谢曾经的相伴</span>
							</div>
							<span class="friend-section__zone-badge">{graveyardFriends.length}</span>
						</div>
						<div class="friend-section__graveyard-grid">
							{#each graveyardFriends as friend (friend.id)}
								<a
									class="friend-section__graveyard-item"
									href={friend.siteurl}
									target="_blank"
									rel="noopener noreferrer"
									title={`${friend.title} (已失联)`}
								>
									<img
										src={friend.imgurl}
										alt={friend.title}
										class="friend-section__graveyard-avatar"
										loading="lazy"
									/>
									<span class="friend-section__graveyard-name">{friend.title}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/key}
	{:else}
		<div class="friend-section__empty">
			<Icon icon="material-symbols:search-off-outline-rounded" aria-hidden="true" />
			<span>{i18n(I18nKey.friendsNoResults)}</span>
		</div>
	{/if}
</Card>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.friend-section
	display: block

	&__tools
		display: flex
		flex-direction: column
		gap: 0.875rem
		padding-bottom: 1.5rem
		border-bottom: 1px solid var(--outline-variant)

	&__search
		position: relative
		width: 100%
		max-width: 32rem

		:global(.m3-text-field)
			width: 100%

	&__search-clear
		position: absolute
		right: 0.5rem
		top: 50%
		transform: translateY(-50%)
		display: inline-flex
		flex-shrink: 0
		align-items: center
		justify-content: center
		width: 1.75rem
		height: 1.75rem
		padding: 0.25rem
		border: none
		background: none
		color: var(--on-surface-variant)
		cursor: pointer
		border-radius: var(--shape-corner-full)
		> :global(svg)
			width: 1.25rem
			height: 1.25rem
		&:hover
			background: unquote("color-mix(in oklab, var(--on-surface-variant) 8%, transparent)")

	&__chips
		width: 100%

	&__count
		margin: 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)

	&__loading
		display: flex
		align-items: center
		justify-content: center
		min-height: 11rem
		padding-top: 1.5rem

		&--out
			animation: friend-loading-out var(--m3e-duration-short) var(--m3e-easing-emphasized-accelerate) both

	&__zones
		display: flex
		flex-direction: column
		gap: 2.5rem
		padding-top: 1.5rem

	&__zone
		&--pending
			padding: 1.25rem
			border-radius: var(--shape-corner-l)
			background: unquote("color-mix(in oklab, #f59e0b 6%, var(--card-bg))")
			border: 1px dashed rgba(245, 158, 11, 0.4)

		&--graveyard
			padding: 1.25rem
			border-radius: var(--shape-corner-l)
			background: unquote("color-mix(in oklab, var(--on-surface) 4%, var(--card-bg))")
			border: 1px dashed var(--outline-variant)

	&__zone-header
		display: flex
		align-items: center
		gap: 0.75rem
		margin-bottom: 1rem

	&__zone-icon
		width: 1.5rem
		height: 1.5rem
		color: #f59e0b

	&__zone-titles
		flex: 1
		display: flex
		flex-direction: column

	&__zone-title
		margin: 0
		font: var(--m3e-type-title-small)
		font-weight: 600
		color: var(--on-surface)

	&__zone-desc
		font: var(--m3e-type-body-small)
		color: var(--on-surface-variant)

	&__zone-badge
		padding: 0.125rem 0.5rem
		font: var(--m3e-type-label-small)
		border-radius: var(--shape-corner-full)
		background: var(--outline-variant)
		color: var(--on-surface-variant)

	&__list
		display: grid
		grid-template-columns: 1fr
		gap: 1rem
		animation: friend-fade-in var(--m3e-duration-medium) var(--m3e-easing-standard)

		@media (min-width: bp-md)
			grid-template-columns: repeat(2, 1fr)

	/* 墓碑墙紧凑置灰头像排布 */
	&__graveyard-grid
		display: flex
		flex-wrap: wrap
		gap: 1rem

	&__graveyard-item
		display: flex
		flex-direction: column
		align-items: center
		gap: 0.375rem
		width: 5.5rem
		padding: 0.5rem
		border-radius: var(--shape-corner-m)
		text-decoration: none
		opacity: 0.7
		transition: all var(--m3e-duration-short) var(--m3e-easing-standard)

		&:hover
			opacity: 1
			background: unquote("color-mix(in oklab, var(--on-surface) 8%, transparent)")

	&__graveyard-avatar
		width: 40px
		height: 40px
		border-radius: 50%
		object-fit: cover
		filter: grayscale(100%)
		border: 1px solid var(--outline-variant)

	&__graveyard-name
		font: var(--m3e-type-label-small)
		color: var(--on-surface-variant)
		text-align: center
		overflow: hidden
		text-overflow: ellipsis
		white-space: nowrap
		width: 100%

	&__empty
		display: flex
		flex-direction: column
		align-items: center
		justify-content: center
		gap: 0.75rem
		min-height: 11rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-large)
		> :global(svg)
			width: 2.5rem
			height: 2.5rem

	@media (max-width: bp-sm - 1px)
		padding: 1rem 0.75rem

/* 悬浮预览 Portal 浮层样式 (通过 :global 确保作用在挂载至 body 的元素上) */
:global(.friend-portal-preview-root)
	position: fixed
	z-index: 99999
	pointer-events: none
	width: 280px
	border-radius: var(--shape-corner-m)
	background: var(--card-bg, #ffffff)
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22)
	border: 1px solid var(--outline-variant)
	overflow: hidden
	animation: friend-portal-in 0.18s cubic-bezier(0, 0, 0.2, 1) both

:global(.friend-portal-preview-card)
	display: flex
	flex-direction: column

:global(.friend-portal-preview-img-wrap)
	position: relative
	width: 100%
	height: 140px
	background: #1e1e2e
	overflow: hidden

:global(.friend-portal-preview-img)
	width: 100%
	height: 100%
	object-fit: cover
	display: block

:global(.friend-portal-preview-img-wrap.is-fallback .friend-portal-preview-img)
	display: none

:global(.friend-portal-preview-fallback)
	display: none
	width: 100%
	height: 100%
	align-items: center
	justify-content: center
	color: #fff
	font-size: 0.9rem
	font-weight: 600
	background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%)

:global(.friend-portal-preview-img-wrap.is-fallback .friend-portal-preview-fallback)
	display: flex

:global(.friend-portal-preview-info)
	padding: 0.625rem 0.75rem
	display: flex
	flex-direction: column
	gap: 2px

:global(.friend-portal-preview-title)
	font-size: 0.8125rem
	font-weight: 600
	color: var(--on-surface)
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap

:global(.friend-portal-preview-url)
	font-size: 0.6875rem
	color: var(--on-surface-variant)
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap

@keyframes friend-portal-in
	from
		opacity: 0
		transform: scale(0.95) translateY(4px)
	to
		opacity: 1
		transform: scale(1) translateY(0)

@keyframes friend-fade-in
	from
		opacity: 0
		transform: translateY(0.25rem)
	to
		opacity: 1
		transform: translateY(0)

@keyframes friend-loading-out
	from
		opacity: 1
		transform: none
	to
		opacity: 0
		transform: scale(0.96)
</style>
