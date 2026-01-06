import InviteClient from "../InviteClient";

export default async function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteClient token={token} />;
}
