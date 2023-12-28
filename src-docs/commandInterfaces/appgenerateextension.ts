export interface appgenerateextension {
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
   * Deprecated. Please use --template
   */
  '-t, --type <value>'?: string

  /**
   * Extension template
   */
  '-t, --template <value>'?: string

  /**
   * name of your Extension
   */
  '-n, --name <value>'?: string

  /**
   * Choose a starting template for your extension, where applicable
   */
  '--flavor <value>'?: string

  /**
   * Reset all your settings.
   */
  '--reset'?: ''

  /**
   * The Client ID of your app.
   */
  '--client-id <value>'?: string
}
