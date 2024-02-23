import {partitionThemeFiles, readThemeFilesFromDisk} from './theme-fs.js'
import {applyIgnoreFilters} from './asset-ignore.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {BulkUploadResult, Checksum, Theme, ThemeFileSystem} from '@shopify/cli-kit/node/themes/types'
import {AssetParams, bulkUploadThemeAssets, deleteThemeAsset} from '@shopify/cli-kit/node/themes/api'
import {fileSize} from '@shopify/cli-kit/node/fs'
import {Task, renderTasks as renderTaskOriginal} from '@shopify/cli-kit/node/ui'
import {outputDebug} from '@shopify/cli-kit/node/output'

interface UploadOptions {
  path: string
  nodelete?: boolean
  ignore?: string[]
  only?: string[]
}
type FileBatch = Checksum[]

// Limits for Bulk Requests
export const MAX_BATCH_FILE_COUNT = 10
// 100KB
export const MAX_BATCH_BYTESIZE = 102400
export const MAX_UPLOAD_RETRY_COUNT = 2

export async function uploadTheme(
  theme: Theme,
  session: AdminSession,
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
) {
  const deleteTasks = await buildDeleteTasks(remoteChecksums, themeFileSystem, options, theme, session)
  const uploadTasks = await buildUploadTasks(remoteChecksums, themeFileSystem, options, theme, session)

  const {jsonTasks, otherTasks} = deleteTasks
  const {liquidUploadTasks, jsonUploadTasks, configUploadTasks, staticUploadTasks} = uploadTasks

  // The sequence of tasks is important here
  await renderTasks(jsonTasks)
  await renderTasks(otherTasks)

  await renderTasks(liquidUploadTasks)
  await renderTasks(jsonUploadTasks)
  await renderTasks(configUploadTasks)
  await renderTasks(staticUploadTasks)
}

async function buildDeleteTasks(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
  theme: Theme,
  session: AdminSession,
) {
  if (options.nodelete) {
    return {jsonTasks: [], otherTasks: []}
  }

  const filteredChecksums = await applyIgnoreFilters(remoteChecksums, themeFileSystem, options)

  const remoteFilesToBeDeleted = await getRemoteFilesToBeDeleted(filteredChecksums, themeFileSystem, options)
  const {jsonFiles, liquidFiles, configFiles, staticAssetFiles} = partitionThemeFiles(remoteFilesToBeDeleted)
  const otherFiles = [...liquidFiles, ...configFiles, ...staticAssetFiles]

  const jsonTasks = createDeleteTasks(jsonFiles, theme.id, session)
  const otherTasks = createDeleteTasks(otherFiles, theme.id, session)

  return {jsonTasks, otherTasks}
}

async function getRemoteFilesToBeDeleted(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
): Promise<Checksum[]> {
  const localKeys = new Set(themeFileSystem.files.keys())
  const filteredChecksums = await applyIgnoreFilters(remoteChecksums, themeFileSystem, options)
  const filesToBeDeleted = filteredChecksums.filter((checksum) => !localKeys.has(checksum.key))
  outputDebug(`Files to be deleted: ${filesToBeDeleted.map((file) => file.key).join(', ')}`)
  return filesToBeDeleted
}

function createDeleteTasks(files: Checksum[], themeId: number, session: AdminSession): Task[] {
  return files.map((file) => ({
    title: `Cleaning your remote theme (removing ${file.key})`,
    task: async () => deleteFileFromRemote(themeId, file, session),
  }))
}

async function deleteFileFromRemote(themeId: number, file: Checksum, session: AdminSession) {
  outputDebug(`Cleaning your remote theme (removing ${file.key})`)
  await deleteThemeAsset(themeId, file.key, session)
}

async function buildUploadTasks(
  remoteChecksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  options: UploadOptions,
  theme: Theme,
  session: AdminSession,
): Promise<{liquidUploadTasks: Task[]; jsonUploadTasks: Task[]; configUploadTasks: Task[]; staticUploadTasks: Task[]}> {
  const filesToUpload = await selectUploadableFiles(themeFileSystem, remoteChecksums, options)

  await readThemeFilesFromDisk(filesToUpload, themeFileSystem)
  const {liquidUploadTasks, jsonUploadTasks, configUploadTasks, staticUploadTasks} = await createUploadTasks(
    filesToUpload,
    themeFileSystem,
    session,
    theme,
  )

  return {liquidUploadTasks, jsonUploadTasks, configUploadTasks, staticUploadTasks}
}

async function createUploadTasks(
  filesToUpload: Checksum[],
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  theme: Theme,
): Promise<{liquidUploadTasks: Task[]; jsonUploadTasks: Task[]; configUploadTasks: Task[]; staticUploadTasks: Task[]}> {
  outputDebug(`Preparing ${filesToUpload.length} to be uploaded to remote theme`)
  const totalFileCount = filesToUpload.length
  const {jsonFiles, liquidFiles, configFiles, staticAssetFiles} = partitionThemeFiles(filesToUpload)

  const {tasks: liquidUploadTasks, updatedFileCount: liquidCount} = await createUploadTaskForFileType(
    liquidFiles,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    0,
  )
  const {tasks: jsonUploadTasks, updatedFileCount: jsonCount} = await createUploadTaskForFileType(
    jsonFiles,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    liquidCount,
  )
  const {tasks: configUploadTasks, updatedFileCount: configCount} = await createUploadTaskForFileType(
    configFiles,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    jsonCount,
  )
  const {tasks: staticUploadTasks} = await createUploadTaskForFileType(
    staticAssetFiles,
    themeFileSystem,
    session,
    theme.id,
    totalFileCount,
    configCount,
  )
  return {liquidUploadTasks, jsonUploadTasks, configUploadTasks, staticUploadTasks}
}

async function createUploadTaskForFileType(
  checksums: Checksum[],
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  themeId: number,
  totalFileCount: number,
  currentFileCount: number,
): Promise<{tasks: Task[]; updatedFileCount: number}> {
  if (checksums.length === 0) {
    return {tasks: [], updatedFileCount: currentFileCount}
  }

  const batches = await createBatches(checksums, themeFileSystem.root)
  const {tasks, updatedFileCount} = await createUploadTaskForBatch(
    batches,
    themeFileSystem,
    session,
    themeId,
    totalFileCount,
    currentFileCount,
  )
  return {tasks, updatedFileCount}
}

function createUploadTaskForBatch(
  batches: FileBatch[],
  themeFileSystem: ThemeFileSystem,
  session: AdminSession,
  themeId: number,
  totalFileCount: number,
  currentFileCount: number,
): {tasks: Task[]; updatedFileCount: number} {
  let runningFileCount = currentFileCount
  const tasks = batches.map((batch) => {
    runningFileCount += batch.length
    const progress = Math.round((currentFileCount / totalFileCount) * 100)
    return {
      title: `Uploading files to remote theme [${progress}%]`,
      task: async () => uploadBatch(batch, themeFileSystem, session, themeId),
    }
  })
  return {
    tasks,
    updatedFileCount: runningFileCount,
  }
}

async function selectUploadableFiles(
  themeFileSystem: ThemeFileSystem,
  remoteChecksums: Checksum[],
  options: UploadOptions,
): Promise<Checksum[]> {
  const localChecksums = calculateLocalChecksums(themeFileSystem)
  const filteredLocalChecksums = await applyIgnoreFilters(localChecksums, themeFileSystem, options)
  const remoteChecksumsMap = new Map<string, Checksum>()
  remoteChecksums.forEach((remote) => {
    remoteChecksumsMap.set(remote.key, remote)
  })

  const filesToUpload = filteredLocalChecksums.filter((local) => {
    const remote = remoteChecksumsMap.get(local.key)
    return !remote || remote.checksum !== local.checksum
  })
  outputDebug(`Files to be uploaded: ${filesToUpload.map((file) => file.key).join(', ')}`)
  return filesToUpload
}

async function createBatches(files: Checksum[], path: string): Promise<FileBatch[]> {
  const fileSizes = await Promise.all(files.map((file) => fileSize(`${path}/${file.key}`)))
  const batches = []

  let currentBatch: Checksum[] = []
  let currentBatchSize = 0

  files.forEach((file, index) => {
    const hasEnoughItems = currentBatch.length >= MAX_BATCH_FILE_COUNT
    const hasEnoughByteSize = currentBatchSize >= MAX_BATCH_BYTESIZE

    if (hasEnoughItems || hasEnoughByteSize) {
      batches.push(currentBatch)
      currentBatch = []
      currentBatchSize = 0
    }

    currentBatch.push(file)
    currentBatchSize += fileSizes[index] ?? 0
  })

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

function calculateLocalChecksums(localThemeFileSystem: ThemeFileSystem): Checksum[] {
  const checksums: Checksum[] = []

  localThemeFileSystem.files.forEach((value, key) => {
    checksums.push({
      key,
      checksum: value.checksum,
    })
  })

  return checksums
}

async function uploadBatch(
  batch: FileBatch,
  localThemeFileSystem: ThemeFileSystem,
  session: AdminSession,
  themeId: number,
) {
  const uploadParams = batch.map((file) => {
    const value = localThemeFileSystem.files.get(file.key)?.value
    const attachment = localThemeFileSystem.files.get(file.key)?.attachment
    return {
      key: file.key,
      ...(value && {value}),
      ...(attachment && {attachment}),
    }
  })
  outputDebug(`Uploading batch containing the following files: ${batch.map((file) => file.key).join(', ')}`)
  const results = await bulkUploadThemeAssets(themeId, uploadParams, session)
  await retryFailures(uploadParams, results, themeId, session)
}

async function retryFailures(
  uploadParams: AssetParams[],
  results: BulkUploadResult[],
  themeId: number,
  session: AdminSession,
  count = 0,
) {
  const succesfulUploads = results.filter((result) => result.success).map((result) => result.key)
  const failedUploadsExist = succesfulUploads.length < uploadParams.length
  if (failedUploadsExist) {
    const succesfulUploadsSet = new Set(succesfulUploads)
    const failedUploadParams = uploadParams.filter((param) => !succesfulUploadsSet.has(param.key))

    if (count === MAX_UPLOAD_RETRY_COUNT) {
      outputDebug(
        `Max retry count reached for the following files: ${failedUploadParams.map((param) => param.key).join(', ')}`,
      )
      return
    }

    outputDebug(`The following files failed to upload: ${failedUploadParams.map((param) => param.key).join(', ')}`)
    outputDebug(`Retry Attempt ${count + 1}/${MAX_UPLOAD_RETRY_COUNT}`)

    const results = await bulkUploadThemeAssets(themeId, failedUploadParams, session)
    await retryFailures(failedUploadParams, results, themeId, session, count + 1)
  }
}

async function renderTasks(tasks: Task[]) {
  if (tasks.length > 0) {
    await renderTaskOriginal(tasks)
  }
}
