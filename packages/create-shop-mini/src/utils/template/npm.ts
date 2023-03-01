import {PackageManager, installNodeModules} from '@shopify/cli-kit/node/node-package-manager'
import {Task} from '@shopify/cli-kit/node/ui'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {glob} from '@shopify/cli-kit/node/fs'
import {platform} from 'os'

export async function getDeepInstallNPMTasks({
  from,
  packageManager,
}: {
  from: string
  packageManager: PackageManager
}): Promise<Task[]> {
  const root = normalizePath(from)
  const packageJSONFiles = await glob([joinPath(root, '**/package.json')])

  return packageJSONFiles.map((filePath) => {
    const folderPath = filePath.replace('package.json', '')
    const titlePath = folderPath.replace(joinPath(root, '/'), '')

    /**
     * Installation of dependencies using Yarn on Windows might lead
     * to "EPERM: operation not permitted, unlink" errors when Yarn tries
     * to access the cache. By limiting the network concurrency we mitigate the
     * error:
     *
     * Failing scenario: https://github.com/Shopify/cli/runs/7913938724
     * Reported issue: https://github.com/yarnpkg/yarn/issues/7212
     */
    const args = platform() === 'win32' && packageManager === 'yarn' ? ['--network-concurrency', '1'] : []
    const title = titlePath === '' ? 'Installing dependencies' : `Installing dependencies in ${titlePath}`
    return {
      title,
      task: async () => {
        await installNodeModules({directory: folderPath, packageManager, args})
      },
    }
  })
}
