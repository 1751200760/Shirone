<script lang="ts">
import Avatar from "@components/atoms/display/Avatar.svelte";
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import type { FriendItem } from "../../data/friends";

let {
	friend,
	status = "success",
	onhover = undefined,
	onleave = undefined,
}: {
	friend: FriendItem;
	status?: "success" | "slow" | "warn" | "timeout";
	onhover?: (e: MouseEvent, friend: FriendItem) => void;
	onleave?: () => void;
} = $props();

let canvasEl: HTMLCanvasElement | null = $state(null);
let animationFrameId: number;

const host = $derived.by(() => {
	try {
		return new URL(friend.siteurl).hostname.replace(/^www\./, "");
	} catch {
		return friend.siteurl;
	}
});

// 粒子特效：站长紫 (四角星芒 auroraFlow) / 推荐金 (五角星流星 starFlow)
function traceRoundedStar(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	points: number,
) {
	ctx.beginPath();
	for (let i = 0; i < points * 2; i++) {
		const r = i % 2 === 0 ? outerR : innerR;
		const angle = (i * Math.PI) / points - Math.PI / 2;
		const x = cx + r * Math.cos(angle);
		const y = cy + r * Math.sin(angle);
		if (i === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.closePath();
	ctx.fill();
}

onMount(() => {
	if (!canvasEl || !friend.state || friend.state === "normal") return;

	// prefers-reduced-motion 适配
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const ctx = canvasEl.getContext("2d");
	if (!ctx) return;

	let width = (canvasEl.width = canvasEl.offsetWidth);
	let height = (canvasEl.height = canvasEl.offsetHeight);

	const isOwner = friend.state === "owner";
	const starCount = isOwner ? 14 : 18;
	const particles = Array.from({ length: starCount }, () => ({
		x: Math.random() * width,
		y: Math.random() * height,
		size: Math.random() * 2.5 + 1.5,
		speedX: (Math.random() - 0.5) * 0.4,
		speedY: isOwner ? (Math.random() - 0.5) * 0.4 : Math.random() * 0.6 + 0.2,
		alpha: Math.random() * 0.7 + 0.3,
		alphaSpeed: (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
	}));

	let isVisible = true;
	const observer = new IntersectionObserver(([entry]) => {
		isVisible = entry.isIntersecting;
	});
	observer.observe(canvasEl);

	function render() {
		if (isVisible && ctx && canvasEl) {
			ctx.clearRect(0, 0, width, height);

			const points = isOwner ? 4 : 5;
			const innerScale = isOwner ? 0.36 : 0.48;
			const fillBase = isOwner ? "141, 124, 255" : "244, 187, 46";

			for (const p of particles) {
				p.x += p.speedX;
				p.y += p.speedY;
				p.alpha += p.alphaSpeed;

				if (p.alpha <= 0.2 || p.alpha >= 0.9) p.alphaSpeed *= -1;
				if (p.x < 0) p.x = width;
				if (p.x > width) p.x = 0;
				if (p.y < 0) p.y = height;
				if (p.y > height) p.y = 0;

				ctx.fillStyle = `rgba(${fillBase}, ${p.alpha})`;
				traceRoundedStar(
					ctx,
					p.x,
					p.y,
					p.size * 2,
					p.size * 2 * innerScale,
					points,
				);
			}
		}
		animationFrameId = requestAnimationFrame(render);
	}

	render();

	const handleResize = () => {
		if (!canvasEl) return;
		width = canvasEl.width = canvasEl.offsetWidth;
		height = canvasEl.height = canvasEl.offsetHeight;
	};
	window.addEventListener("resize", handleResize);

	return () => {
		cancelAnimationFrame(animationFrameId);
		observer.disconnect();
		window.removeEventListener("resize", handleResize);
	};
});
</script>

<a
	class="friend-card m3-state-layer"
	class:friend-card--owner={friend.state === "owner"}
	class:friend-card--featured={friend.state === "featured"}
	data-status={status}
	data-siteshot={friend.siteshot || ""}
	href={friend.siteurl}
	target="_blank"
	rel="noopener noreferrer"
	aria-label={friend.title}
	onmouseenter={(e) => onhover?.(e, friend)}
	onmouseleave={() => onleave?.()}
>
	{#if friend.state === "owner" || friend.state === "featured"}
		<canvas bind:this={canvasEl} class="friend-card__canvas" aria-hidden="true"></canvas>
	{/if}

	<div class="friend-card__body">
		<div class="friend-card__header">
			<div class="friend-card__avatar-wrap">
				<Avatar
					src={friend.imgurl}
					alt={friend.title}
					size={44}
					shape="circle"
				/>
				<!-- 状态指示徽标 -->
				<span
					class="friend-card__status-dot"
					class:friend-card__status-dot--success={status === "success"}
					class:friend-card__status-dot--slow={status === "slow"}
					class:friend-card__status-dot--warn={status === "warn"}
					class:friend-card__status-dot--timeout={status === "timeout"}
					title={status === "success" ? "访问正常" : status === "slow" ? "响应较慢" : "异常波动"}
				></span>
			</div>

			<div class="friend-card__info">
				<div class="friend-card__title">
					<span class="friend-card__title-text">{friend.title}</span>
					{#if friend.state === "owner"}
						<span class="friend-card__badge friend-card__badge--owner">
							<Icon icon="material-symbols:home-rounded" /> 站长
						</span>
					{:else if friend.state === "featured"}
						<span class="friend-card__badge friend-card__badge--featured">
							<Icon icon="material-symbols:star-rounded" /> 推荐
						</span>
					{/if}
				</div>

				<div class="friend-card__host">
					<span>{host}</span>
				</div>
			</div>

			<span class="friend-card__arrow" aria-hidden="true">
				<Icon icon="material-symbols:arrow-outward-rounded" />
			</span>
		</div>

		{#if friend.desc}
			<p class="friend-card__desc">{friend.desc}</p>
		{/if}

		{#if friend.tags.length > 0}
			<div class="friend-card__tags">
				{#each friend.tags as tag (tag)}
					<span class="friend-card__tag">#{tag}</span>
				{/each}
			</div>
		{/if}
	</div>
</a>

<style lang="stylus">
.friend-card
	position: relative
	display: flex
	flex-direction: column
	box-sizing: border-box
	width: 100%
	overflow: hidden
	border-radius: var(--shape-corner-l)
	background: var(--card-bg)
	color: var(--on-surface)
	border: 1px solid var(--outline-variant)
	text-decoration: none
	transition:
		border-color var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
		box-shadow var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
		background-color var(--m3e-duration-medium) var(--m3e-easing-standard),
		transform var(--m3e-duration-short) var(--m3e-easing-standard)

	&:hover
		border-color: var(--outline)
		box-shadow: var(--m3e-elevation-1)
		background: unquote("color-mix(in oklab, var(--primary) 5%, var(--card-bg))")
		transform: translateY(-2px)

	/* 站长紫 */
	&--owner
		border-color: rgba(141, 124, 255, 0.45)
		background: linear-gradient(135deg, rgba(141, 124, 255, 0.08) 0%, var(--card-bg) 60%)
		&:hover
			border-color: #8d7cff
			box-shadow: 0 4px 16px rgba(141, 124, 255, 0.25)
			background: linear-gradient(135deg, rgba(141, 124, 255, 0.14) 0%, var(--card-bg) 60%)

	/* 推荐金 */
	&--featured
		border-color: rgba(244, 187, 46, 0.45)
		background: linear-gradient(135deg, rgba(244, 187, 46, 0.08) 0%, var(--card-bg) 60%)
		&:hover
			border-color: #f4bb2e
			box-shadow: 0 4px 16px rgba(244, 187, 46, 0.25)
			background: linear-gradient(135deg, rgba(244, 187, 46, 0.14) 0%, var(--card-bg) 60%)

	&__canvas
		position: absolute
		inset: 0
		width: 100%
		height: 100%
		pointer-events: none
		z-index: 0

	&__body
		position: relative
		z-index: 1
		flex: 1
		min-width: 0
		padding: var(--m3e-space-4) var(--m3e-space-5)

	&__header
		display: flex
		align-items: center
		gap: var(--m3e-space-3)
		margin-bottom: var(--m3e-space-3)

	&__avatar-wrap
		position: relative
		display: inline-flex

	&__status-dot
		position: absolute
		bottom: -1px
		right: -1px
		width: 10px
		height: 10px
		border-radius: 50%
		border: 2px solid var(--card-bg)
		&--success
			background-color: #10b981
		&--slow
			background-color: #f59e0b
		&--warn, &--timeout
			background-color: #ef4444

	&__info
		min-width: 0
		flex: 1

	&__title
		display: flex
		align-items: center
		gap: 0.375rem
		margin: 0
		color: var(--on-surface)
		font: var(--m3e-type-title-small)
		font-weight: 600
		line-height: 1.3
		text-decoration: none
		transition: color var(--m3e-duration-short) var(--m3e-easing-standard)
		.friend-card:hover &
			color: var(--primary)

	&__badge
		display: inline-flex
		align-items: center
		gap: 2px
		padding: 1px 6px
		font-size: 0.6875rem
		font-weight: 600
		border-radius: var(--shape-corner-xs)
		line-height: 1.2
		&--owner
			background-color: rgba(141, 124, 255, 0.2)
			color: #8d7cff
		&--featured
			background-color: rgba(244, 187, 46, 0.2)
			color: #d97706

	&__title-text
		min-width: 0
		overflow: hidden
		text-overflow: ellipsis
		white-space: nowrap

	&__host
		margin-top: 0.125rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)

	&__arrow
		display: inline-flex
		align-items: center
		flex-shrink: 0
		color: var(--on-surface-variant)
		transition:
			color var(--m3e-duration-short) var(--m3e-easing-standard),
			transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)
		> :global(svg)
			width: 1.25rem
			height: 1.25rem

		.friend-card:hover &
			color: var(--primary)
			transform: translate(0.15rem, -0.15rem)

	&__desc
		margin: 0 0 var(--m3e-space-2)
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.5
		display: -webkit-box
		-webkit-line-clamp: 2
		-webkit-box-orient: vertical
		overflow: hidden

	&__tags
		display: flex
		flex-wrap: wrap
		gap: var(--m3e-space-1)

	&__tag
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)
</style>
