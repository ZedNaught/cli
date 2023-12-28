export interface appfunctionrun {
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
   * The input JSON to pass to the function. If omitted, standard input is used.
   */
  '-i, --input <value>'?: string

  /**
   * Name of the wasm export to invoke.
   */
  '-e, --export <value>'?: string

  /**
   * Log the run result as a JSON object.
   */
  '-j, --json'?: ''
}
