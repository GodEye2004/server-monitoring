import { __awaiter } from "tslib";
import { getJestProjectsAsync } from '@nx/jest';
export default () => __awaiter(void 0, void 0, void 0, function* () {
    return ({
        projects: yield getJestProjectsAsync()
    });
});
//# sourceMappingURL=jest.config.js.map