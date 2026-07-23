<div class="flex flex-col gap-12">
	<div class="relative min-h-[60vh] w-full md:min-h-[65vh] lg:min-h-[70vh]">
		<div class="absolute inset-0 flex items-end px-[10%] py-12">
			<div class="w-full max-w-2xl space-y-6">
				<div class="h-12 w-3/4 rounded-lg shimmer"></div>
				<div class="flex gap-3">
					<div class="h-6 w-20 rounded-full shimmer"></div>
					<div class="h-6 w-32 rounded-full shimmer"></div>
					<div class="h-6 w-16 rounded-full shimmer"></div>
				</div>
				<div class="space-y-2">
					<div class="h-4 w-full rounded shimmer"></div>
					<div class="h-4 w-5/6 rounded shimmer"></div>
					<div class="h-4 w-4/6 rounded shimmer"></div>
				</div>
				<div class="flex gap-4">
					<div class="h-11 w-32 rounded shimmer"></div>
					<div class="h-11 w-11 rounded-full shimmer"></div>
				</div>
			</div>
		</div>
	</div>

	<div class="space-y-12 px-[10%]">
		{#each Array.from({ length: 3 }, (_, rowIndex) => rowIndex) as rowIndex (rowIndex)}
			<div class="space-y-4">
				<div class="h-8 w-48 rounded shimmer"></div>
				<div class="flex gap-4 overflow-hidden">
					{#each Array.from({ length: 6 }, (_, itemIndex) => itemIndex) as itemIndex (itemIndex)}
						<div class="aspect-[2/3] w-40 shrink-0 rounded-lg shimmer"></div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
