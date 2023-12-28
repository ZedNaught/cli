export interface appbuild {
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
   * Skips the installation of dependencies. Deprecated, use workspaces instead.
   */
  '--skip-dependencies-installation'?: ''

  /**
   * Application's Client ID that will be exposed at build time.
   */
  '--client-id <value>'?: string
}
