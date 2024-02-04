<template>
  <div id="app">
    <Board/>
  </div>
</template>

<script>
import Board from './components/Board.vue';

export default {
  name: 'App',
  components: {
    Board
  }
}
</script>

<style>
body {
  margin: 0;
}
#app {
  height: 100vh;
  width: 100vw;
}
</style>
