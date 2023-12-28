export interface appdev {
  /**
   * Disable color output.
   */
  '--no-color'?: ''

  /**
   * Increase the verbosity of the logs.
   */
  '--verbose'?: ''

  /**
   * The path to your app directory.
   */
  '--path <value>'?: string

  /**
   * The name of the app configuration.
   */
  '-c, --config <value>'?: string

  /**
   * The Client ID of your app.
   */
  '--client-id <value>'?: string

  /**
   * Store URL. Must be an existing development or Shopify Plus sandbox store.
   */
  '-s, --store <value>'?: string

  /**
   * Reset all your settings.
   */
  '--reset'?: ''

  /**
   * Skips the installation of dependencies. Deprecated, use workspaces instead.
   */
  '--skip-dependencies-installation'?: ''

  /**
   * Skips the Partners Dashboard URL update step.
   */
  '--no-update'?: ''

  /**
   * Resource URL for subscription UI extension. Format: "/products/{productId}"
   */
  '--subscription-product-url <value>'?: string

  /**
   * Resource URL for checkout UI extension. Format: "/cart/{productVariantID}:{productQuantity}"
   */
  '--checkout-cart-url <value>'?: string

  /**
   * Use a custom tunnel, it must be running before executing dev. Format: "https://my-tunnel-url:port".
   */
  '--tunnel-url <value>'?: string

  /**
   * Theme ID or name of the theme app extension host theme.
   */
  '-t, --theme <value>'?: string

  /**
   * Local port of the theme app extension development server.
   */
  '--theme-app-extension-port <value>'?: string

  /**
   * The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a webhook posted to report on file changes.
   */
  '--notify <value>'?: string
}
