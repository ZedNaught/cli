import {gql} from 'graphql-request'

export const ActiveAppReleaseQuery = gql`
  query activeAppRelease($id: ID!) {
    app(id: $ID) {
      activeRelease {
        id
        version {
          modules {
            gid
            handle
            config
            specification {
              identifier
              name
              experience
            }
          }
        }
      }
    }
  }
`

/*         appModuleVersions { */
          /* registrationId */
          /* registrationUuid */
          /* registrationTitle */
          /* type */
          /* config */
          /* specification { */
            /* identifier */
            /* name */
            /* experience */
            /* options { */
              /* managementExperience */
            /* } */
          /* } */
        /* } */
/*       } */

export interface ActiveAppReleaseQueryVariables {
  id: string
}

interface AppModuleVersionSpecification {
  identifier: string
  name: string
  experience: 'extension' | 'configuration' | 'deprecated'
  options: {
    managementExperience: 'cli' | 'custom' | 'dashboard'
  }
}

export interface AppModuleVersion {
  registrationId: string
  registrationUuid: string
  registrationTitle: string
  config?: string
  type: string
  specification?: AppModuleVersionSpecification
}

export interface ActiveAppVersionQuerySchema {
  app: {
    activeAppVersion: {
      appModuleVersions: AppModuleVersion[]
    }
  }
}
