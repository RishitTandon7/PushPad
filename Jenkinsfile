// PushPad pipeline: every branch gets its own EC2 preview; main deploys to prod after approval.
pipeline {
  agent any

  options {
    timeout(time: 45, unit: 'MINUTES')
    disableConcurrentBuilds()
  }

  environment {
    AWS_DEFAULT_REGION = 'ap-south-1'
    TF_IN_AUTOMATION   = '1'
  }

  stages {
    // 1. Checkout: get the code and work out which workspace/env this branch maps to.
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.WS = sh(script: './scripts/workspace-name.sh "$BRANCH_NAME"', returnStdout: true).trim()
          env.ENV_TYPE = (env.WS == 'prod') ? 'prod' : 'preview'
          env.COMMIT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.ZIP_NAME = "app-${env.WS}-${env.BUILD_NUMBER}.zip"
          env.ZIP_KEY = "builds/${env.WS}/${env.ZIP_NAME}"
        }
        echo "Branch '${env.BRANCH_NAME}' -> workspace '${env.WS}' (${env.ENV_TYPE})"
      }
    }
  }
}
