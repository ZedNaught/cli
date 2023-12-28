export interface themedelete {
  /**
   * Disable color output.
   */
  '--no-color'?: ''

  /**
   * Increase the verbosity of the logs.
   */
  '--verbose'?: ''

  /**
   * Password generated from the Theme Access app.
   */
  '--password <value>'?: string

  /**
   * Delete your development theme.
   */
  '-d, --development'?: ''

  /**
   * Include others development themes in theme list.
   */
  '-a, --show-all'?: ''

  /**
   * Skip confirmation.
   */
  '-f, --force'?: ''

  /**
   * Theme ID or name of the remote theme.
   */
  '-t, --theme <value>'?: string

  /**
   * Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
   */
  '-s, --store <value>'?: string

  /**
   * The environment to apply to the current command.
   */
  '-e, --environment <value>'?: string
}
