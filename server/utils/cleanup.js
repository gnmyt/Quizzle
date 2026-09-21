/**
 * Practice quizzes are deliberately never removed automatically.
 *
 * Expired tests stay visible for admins, keep their stored results, and can only be
 * deleted manually through DELETE /api/admin/practice/:code. The previous periodic
 * cleanup job was removed on purpose.
 */

const startCleanupTask = () => {
};

module.exports = {
    startCleanupTask
};
