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

    // 2. Install and Lint: reproducible install from the lockfile, then ESLint.
    stage('Install and Lint') {
      steps {
        dir('app') {
          sh 'npm ci'
          sh 'npm run lint'
        }
      }
    }

    // 3. Test: Jest must pass (a bad menu.json fails here) and results are published to Jenkins.
    stage('Test') {
      steps {
        dir('app') {
          sh 'npm test'
        }
      }
      post {
        always {
          junit allowEmptyResults: true, testResults: 'app/reports/junit.xml'
        }
      }
    }

    // 4. Package: stamp version.json, keep production deps only, zip app/ so boot needs no npm install.
    stage('Package') {
      steps {
        sh '''
          jq -n --arg branch "$BRANCH_NAME" --argjson build "$BUILD_NUMBER" --arg commit "$COMMIT" \
                --arg deployedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg env "$ENV_TYPE" \
                '{branch: $branch, build: $build, commit: $commit, deployedAt: $deployedAt, env: $env}' \
                > app/version.json
          (cd app && npm ci --omit=dev)
          zip -qr "$ZIP_NAME" app -x 'app/tests/*' 'app/reports/*'
        '''
      }
    }

    // 5. Upload to S3: put the zip in the artifacts bucket where the new EC2 will download it.
    stage('Upload to S3') {
      steps {
        sh '''
          . ./scripts/aws-env.sh
          aws s3 cp "$ZIP_NAME" "s3://$ARTIFACTS_BUCKET/$ZIP_KEY"
        '''
      }
    }

    // 6. Terraform Init: connect to remote state, then select (or create) this branch workspace.
    stage('Terraform Init') {
      steps {
        dir('infra') {
          sh '''
            . ../scripts/aws-env.sh
            terraform init -input=false -backend-config="bucket=$STATE_BUCKET"
            terraform workspace select -or-create "$WS"
          '''
        }
      }
    }

    // 7. Approval: only main (prod) waits for a human to click Deploy.
    stage('Approval') {
      when { branch 'main' }
      steps {
        timeout(time: 30, unit: 'MINUTES') {
          input message: "Deploy build ${env.BUILD_NUMBER} to PROD?", ok: 'Deploy'
        }
      }
    }

    // 8. Terraform Apply: create/replace the environment with the new build; remember the prod rollback target.
    stage('Terraform Apply') {
      steps {
        dir('infra') {
          sh '''
            . ../scripts/aws-env.sh
            if [ "$ENV_TYPE" = "prod" ]; then
              # Save the last healthy prod build as the rollback target (ignore on first deploy).
              aws s3 cp "s3://$ARTIFACTS_BUCKET/prod/current.txt" "s3://$ARTIFACTS_BUCKET/prod/previous.txt" || true
            fi
            terraform apply -auto-approve -input=false \
              -var "app_version=$ZIP_KEY" -var "branch=$BRANCH_NAME" -var "env=$ENV_TYPE" \
              -var "artifacts_bucket=$ARTIFACTS_BUCKET"
          '''
          script {
            env.APP_URL = sh(script: 'terraform output -raw url', returnStdout: true).trim()
          }
        }
      }
    }
  }
}
