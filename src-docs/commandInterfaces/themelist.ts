export interface themelist {
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
   * Store URL. It can be the store prefix (johns-apparel) or the full myshopify.com URL (johns-apparel.myshopify.com, https://johns-apparel.myshopify.com).
   */
  '-s, --store <value>'?: string

  /**
   * Only list themes with the given role.
   */
  '--role <value>'?: string

  /**
   * Only list themes that contain the given name.
   */
  '--name <value>'?: string

  /**
   * Only list theme with the given ID.
   */
  '--id <value>'?: string

  /**
   * Output the theme list as JSON.
   */
  '--json'?: ''

  /**
   * The environment to apply to the current command.
   */
  '-e, --environment <value>'?: string
}
