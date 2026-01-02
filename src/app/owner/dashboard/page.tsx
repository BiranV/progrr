import { collections } from "@/server/collections";
import { redirect } from "next/navigation";
import { requireAppUser } from "@/server/auth";

export default async function OwnerDashboard() {
  const user = await requireAppUser();
  const ownerEmail = String(process.env.OWNER_EMAIL ?? "")
    .trim()
    .toLowerCase();

  if (
    user.role !== "admin" ||
    !ownerEmail ||
    user.email.toLowerCase() !== ownerEmail
  ) {
    redirect("/dashboard");
  }

  const c = await collections();
  const admins = await c.admins
    .find({}, { projection: { email: 1, createdAt: 1, subscriptionStatus: 1 } })
    .sort({ createdAt: -1 })
    .toArray();

  const entitiesCountByAdmin = await c.entities
    .aggregate([{ $group: { _id: "$adminId", count: { $sum: 1 } } }])
    .toArray();

  const entitiesCountMap = new Map(
    entitiesCountByAdmin.map((x: any) => [String(x._id), Number(x.count) || 0])
  );

  const totalAdmins = admins.length;
  const activeSubs = admins.filter(
    (a) =>
      a.subscriptionStatus === "ACTIVE" || a.subscriptionStatus === "TRIALING"
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Total Coaches</h3>
          <p className="text-3xl font-bold mt-2">{totalAdmins}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">
            Active Subscriptions
          </h3>
          <p className="text-3xl font-bold mt-2">{activeSubs}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm font-medium">Total Entities</h3>
          <p className="text-3xl font-bold mt-2">
            {admins.reduce(
              (acc, curr) =>
                acc + (entitiesCountMap.get(String(curr._id)) ?? 0),
              0
            )}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-medium">Registered Coaches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entities
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {admins.map((admin) => (
                <tr key={admin._id.toHexString()}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {admin.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(
                      admin.createdAt ?? admin._id.getTimestamp()
                    ).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${
                        admin.subscriptionStatus === "ACTIVE"
                          ? "bg-green-100 text-green-800"
                          : admin.subscriptionStatus === "TRIALING"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {admin.subscriptionStatus ?? "CANCELED"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entitiesCountMap.get(String(admin._id)) ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
