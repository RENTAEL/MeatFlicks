<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';

	let { ref = $bindable(null), asChild = false, ...restProps }: DropdownMenuPrimitive.TriggerProps & { asChild?: boolean } = $props();
</script>

<DropdownMenuPrimitive.Trigger bind:ref data-slot="dropdown-menu-trigger" {asChild} {...restProps} />
