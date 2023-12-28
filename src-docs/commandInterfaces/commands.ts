export interface commands {
  /**
   * Format output as json.
   */
  '--json'?: ''

  /**
   * Show CLI help.
   */
  '-h, --help'?: ''

  /**
   * show hidden commands
   */
  '--hidden'?: ''

  /**
   * show tree of commands
   */
  '--tree'?: ''

  /**
   * only show provided columns (comma-separated)
   */
  '--columns <value>'?: string

  /**
   * property to sort by (prepend '-' for descending)
   */
  '--sort <value>'?: string

  /**
   * filter property by partial string matching, ex: name=foo
   */
  '--filter <value>'?: string

  /**
   * output is csv format [alias: --output=csv]
   */
  '--csv'?: ''

  /**
   * output in a more machine friendly format
   */
  '--output <value>'?: string

  /**
   * show extra columns
   */
  '-x, --extended'?: ''

  /**
   * do not truncate output to fit screen
   */
  '--no-truncate'?: ''

  /**
   * hide table header from output
   */
  '--no-header'?: ''
}
