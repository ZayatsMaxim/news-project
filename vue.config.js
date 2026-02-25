import { defineConfig } from '@vue/cli-service'

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: process.env.NODE_ENV === 'production' ? '/vue-deploy/' : '/',
})
