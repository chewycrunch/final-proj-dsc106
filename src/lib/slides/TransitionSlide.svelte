<script lang="ts">
	interface Props {
		lines: string[];
	}

	let { lines }: Props = $props();
</script>

<div class="fixed inset-0 h-screen w-screen">
	<div
		class="text-text-primary mx-auto max-w-5xl px-4 text-center text-4xl font-semibold md:text-5xl"
	>
		<div class="typing-container">
			<div class="typing-wrapper">
				{#each lines as line, i}
					<div class="typing-line">
						<span
							class="typing-text"
							class:first-line={i === 0}
							class:second-line={i === 1}
							style="--delay: {i * 1.5}s">{line}</span
						>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.typing-container {
		height: 100vh;
		width: 100%;
		position: fixed;
		top: 0;
		left: 0;
	}

	.typing-wrapper {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: inline-block;
		text-align: center;
	}

	.typing-line {
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		height: 1.25em;
		position: relative;
	}

	.typing-line:not(:last-child) {
		margin-bottom: 0.2em;
	}

	.typing-text {
		display: inline-block;
		overflow: hidden;
		white-space: nowrap;
		width: 0;
		text-align: center;
		position: relative;
		animation: typing 1.5s steps(30, end) var(--delay) forwards;
		line-height: normal;
	}

	.typing-text::after {
		content: '';
		position: absolute;
		right: -3px;
		top: 0;
		width: 3px;
		height: 1em;
		background-color: #4f46e5;
		animation: blink 0.75s step-end infinite;
		opacity: 0;
	}

	.typing-text.first-line::after,
	.typing-text.second-line::after {
		animation:
			blink 0.75s step-end infinite,
			show-cursor 0s var(--delay) forwards;
	}

	@keyframes typing {
		from {
			width: 0;
		}
		to {
			width: 100%;
		}
	}

	@keyframes blink {
		from,
		to {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	@keyframes show-cursor {
		to {
			opacity: 1;
		}
	}
</style>
