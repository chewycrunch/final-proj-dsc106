<script lang="ts">
	
    interface Props {
        lines: string[];
    }

    let { lines }: Props = $props();


</script>

	<div class="flex min-h-screen items-center justify-center">
		<div class="text-4xl md:text-5xl font-semibold text-indigo-900 text-center max-w-5xl mx-auto px-4">
			<div class="typing-container">
				<div class="typing-wrapper">
                    {#each lines as line}
					<div class="typing-line">
						<span class="typing-text first-line">{line}</span>
					</div>
                    {/each}
				</div>
			</div>
		</div>
	</div>
