export interface themeinit {
  /**
   * Disable color output.
   */
  '--no-color'?: ''

  /**
   * Increase the verbosity of the logs.
   */
  '--verbose'?: ''

  /**
   * The path to your theme directory.
   */
  '--path <value>'?: string

  /**
   * The Git URL to clone from. Defaults to Shopify's example theme, Dawn: https://github.com/Shopify/dawn.git
   */
  '-u, --clone-url <value>'?: string

  /**
   * Downloads the latest release of the `clone-url`
   */
  '-l, --latest'?: ''
}
