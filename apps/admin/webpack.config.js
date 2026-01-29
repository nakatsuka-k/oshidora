// Custom Expo Webpack config to ensure Browser-style routing works on reload.
// This enables SPA fallback for routes like /video-tags.

const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Ensure deep links (e.g. /video-tags) serve index.html in dev.
  if (config.devServer) {
    config.devServer.historyApiFallback = true;
  } else {
    config.devServer = { historyApiFallback: true };
  }

  return config;
};
