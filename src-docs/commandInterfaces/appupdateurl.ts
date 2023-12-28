export interface appupdateurl {
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
   * URL through which merchants will access your app.
   */
  '--app-url <value>'?: string

  /**
   * Comma separated list of allowed URLs where merchants are redirected after the app is installed
   */
  '--redirect-urls <value>'?: string
}
