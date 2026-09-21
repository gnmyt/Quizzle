const isAdminUser = (user) => user?.role === 'admin';

/**
 * Legacy quizzes and practice tests created before ownership existed have no owner.
 * They stay manageable by admins but are never attributed to a teacher.
 */
const isOwner = (ownerId, user) => Boolean(ownerId) && Boolean(user?.id) && ownerId === user.id;

const canManage = (ownerId, user) => isAdminUser(user) || isOwner(ownerId, user);

const isVisibleTo = (ownerId, user) => {
    if (!user) return false;
    if (isAdminUser(user)) return true;
    return isOwner(ownerId, user);
};

module.exports = {isAdminUser, isOwner, canManage, isVisibleTo};
