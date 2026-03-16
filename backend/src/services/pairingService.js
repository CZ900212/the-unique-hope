const { db } = require("../lib/instant");
const { HttpError } = require("../utils/httpError");

async function getPairingForTeacher(teacherId) {
  const { pairings } = await db.query({
    pairings: {
      $: { where: { "teacher.id": teacherId } },
      student: {}
    }
  });

  const pairing = pairings?.[0];
  if (!pairing) {
    throw new HttpError(404, "Teacher has no assigned student", "PAIRING_NOT_FOUND");
  }

  return pairing;
}

async function getPairingForStudent(studentId) {
  const { pairings } = await db.query({
    pairings: {
      $: { where: { "student.id": studentId } },
      teacher: {}
    }
  });

  const pairing = pairings?.[0];
  if (!pairing) {
    throw new HttpError(404, "Student has no assigned teacher", "PAIRING_NOT_FOUND");
  }

  return pairing;
}

module.exports = {
  getPairingForTeacher,
  getPairingForStudent
};
