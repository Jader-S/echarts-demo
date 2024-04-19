<template>
  <div id="app">
    <!-- <Board/> -->
    <Scroll/>
  </div>
</template>

<script>
// import Board from './components/Board.vue';
import Scroll from './components/Scroll.vue'

export default {
  name: 'App',
  components: {
    // Board
    Scroll
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
