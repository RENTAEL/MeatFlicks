<script lang="ts">
	let { children } = $props();
</script>

<div class="afrikaans-layout">
	<header class="afrikaans-header">
		<h1>Afrikaanse Flieks</h1>
		<p>'n Versameling van die beste Afrikaanse rolprente — A collection of the best Afrikaans films.</p>
	</header>

	{@render children()}
</div>

<style>
	.afrikaans-layout {
		min-height: 100vh;
	}

	.afrikaans-header {
		text-align: center;
		padding: 2rem 1rem;
		background: linear-gradient(135deg, #1a1a2e, #16213e);
	}

	.afrikaans-header h1 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
		color: #fff;
	}

	.afrikaans-header p {
		color: #aaa;
		max-width: 600px;
		margin: 0 auto;
		font-style: italic;
	}
</style>
