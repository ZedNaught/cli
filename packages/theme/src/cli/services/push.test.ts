import {push} from './push.js'
import {hasRequiredThemeDirectories, mountThemeFileSystem} from '../utilities/theme-fs.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {buildTheme} from '@shopify/cli-kit/node/themes/factories'
import {test, describe, vi} from 'vitest'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/api'
import {ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'

vi.mock('../utilities/theme-fs.js')
vi.mock('@shopify/cli-kit/node/path')
vi.mock('../utilities/theme-uploader.js')
vi.mock('@shopify/cli-kit/node/themes/api')

describe('push', () => {
  const adminSession = {token: '', storeFqdn: ''}
  const theme = buildTheme({id: 1, name: 'Theme', role: 'development'})!

  test('Should raise an error if the provided path is not a valid theme directory', async ({expect}) => {
    // Given
    vi.mocked(resolvePath).mockReturnValue('/invalid/path')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)

    // When
    const pushPromise = push(theme, adminSession, {path: '/invalid/path'})

    // Then
    await expect(pushPromise).rejects.toThrow(new Error('Invalid theme directory: /invalid/path'))
  })

  test('Should use the current working directory if no path is provided', async ({expect}) => {
    // Given
    const fileSystem = {
      root: 'tmp',
      files: new Map([]),
    } as ThemeFileSystem
    vi.mocked(cwd).mockReturnValue('/current/working/directory')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
    vi.mocked(mountThemeFileSystem).mockResolvedValue(fileSystem)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await push(theme, adminSession, {})

    // Then
    expect(uploadTheme).toBeCalledWith(theme, adminSession, [], fileSystem, {path: '/current/working/directory'})
  })

  test('should use the provided path if it is provided', async ({expect}) => {
    // Given
    vi.mocked(resolvePath).mockReturnValue('/provided/path')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(true)
    vi.mocked(fetchChecksums).mockResolvedValue([])

    // When
    await push(theme, adminSession, {path: '/provided/path'})

    // Then
    expect(hasRequiredThemeDirectories).toBeCalledWith('/provided/path')
  })

  test('should throw an error if the working directory does not have the required structure', async ({expect}) => {
    // Given
    vi.mocked(cwd).mockReturnValue('/current/working/directory')
    vi.mocked(hasRequiredThemeDirectories).mockResolvedValue(false)

    // When
    const pushPromise = push(theme, adminSession, {})

    // Then
    await expect(pushPromise).rejects.toThrow(new Error('Invalid theme directory: /current/working/directory'))
  })
})
