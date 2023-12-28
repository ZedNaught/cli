export interface appgenerateschema {
  /**
   * Disable color output.
   */
  '--no-color'?: ''

  /**
   * Increase the verbosity of the logs.
   */
  '--verbose'?: ''

  /**
   * The path to your function directory.
   */
  '--path <value>'?: string

  /**
   * The name of the app configuration.
   */
  '-c, --config <value>'?: string

  /**
   * The Client ID to fetch the schema with.
   */
  '--client-id <value>'?: string

  /**
   * Output the schema to stdout instead of writing to a file.
   */
  '--stdout'?: ''
}
