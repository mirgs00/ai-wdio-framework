// src/services/mlAutomationService.ts
import { Services } from '@wdio/types';
import { MLService } from '../ml/mlService';

interface MLServiceOptions {
    enableSelfHealing?: boolean;
    enableFailureLearning?: boolean;
    maxRecoveryAttempts?: number;
}

export default class MLAutomationService implements Services.ServiceInstance {
    public options: MLServiceOptions;

    constructor(serviceOptions: MLServiceOptions) {
        this.options = {
            enableSelfHealing: true,
            enableFailureLearning: true,
            maxRecoveryAttempts: 3,
            ...serviceOptions,
        };
    }

    async onPrepare() {
        console.log('[ML Service] Preparing for test run...');
        await MLService.initializeModels();
    }

    async onComplete() {
        console.log('[ML Service] Test run complete. Processing results...');
        await MLService.processExecutionResults();
        await MLService.retrainIfNeeded();
    }
}