export interface themecheck {
  /**
   * Disable color output.
   */
  '--no-color'?: ''

  /**
   * Increase the verbosity of the logs.
   */
  '--verbose'?: ''

  /**
   * Use the dev preview version of theme check
Applies the typescript implementation of theme check to the theme
   */
  '--dev-preview'?: ''

  /**
   * The path to your theme directory.
   */
  '--path <value>'?: string

  /**
   * Automatically fix offenses
   */
  '-a, --auto-correct'?: ''

  /**
   * Only run this category of checks
Runs checks matching all categories when specified more than once
   */
  '-c, --category <value>'?: string

  /**
   * Use the config provided, overriding .theme-check.yml if present
      Supports all theme-check: config values, e.g., theme-check:theme-app-extension,
      theme-check:recommended, theme-check:all
      For backwards compatibility, :theme_app_extension is also supported 
   */
  '-C, --config <value>'?: string

  /**
   * Exclude this category of checks
Excludes checks matching any category when specified more than once
   */
  '-x, --exclude-category <value>'?: string

  /**
   * Minimum severity for exit with error code
   */
  '--fail-level <value>'?: string

  /**
   * Update Theme Check docs (objects, filters, and tags)
   */
  '--update-docs'?: ''

  /**
   * Generate a .theme-check.yml file
   */
  '--init'?: ''

  /**
   * List enabled checks
   */
  '--list'?: ''

  /**
   * The output format to use
   */
  '-o, --output <value>'?: string

  /**
   * Output active config to STDOUT
   */
  '--print'?: ''

  /**
   * Print Theme Check version
   */
  '-v, --version'?: ''

  /**
   * The environment to apply to the current command.
   */
  '-e, --environment <value>'?: string
}
