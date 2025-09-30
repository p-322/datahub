import {createClerkClient} from '@clerk/backend';
import {resetDb} from './database';
import {env} from 'node:process';

const clerkClient = createClerkClient({
  secretKey: env.CLERK_SECRET_KEY!,
});

interface CreateUserProps {
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
  testId: string;
}

export async function getUserByEmail(emailAddress: string) {
  const userList = await clerkClient.users.getUserList({
    emailAddress: [emailAddress],
  });
  return userList.data[0] || null;
}

interface CreateUserProps {
  firstName: string;
  lastName: string;
  emailAddress: string;
  password: string;
  testId: string;
}

export async function createUser({
  firstName,
  lastName,
  emailAddress,
  password,
  testId,
}: CreateUserProps) {
  try {
    return await clerkClient.users.createUser({
      firstName,
      lastName,
      emailAddress: [emailAddress],
      password,
      unsafeMetadata: {
        iri: `https://example.com/${testId}`,
      },
    });
  } catch (error: any) {
    console.error('Error creating user:', {
      emailAddress,
      error: error.message,
      status: error.status,
      errors: error.errors,
    });
    throw error;
  }
}

interface CreateCommunityProps {
  userId: string;
  name: string;
  slug: string;
}

export async function createCommunity({
  userId,
  name,
  slug,
}: CreateCommunityProps) {
  return clerkClient.organizations.createOrganization({
    name,
    slug,
    createdBy: userId,
    publicMetadata: {
      iri: `https://example.com/${slug}`,
      description:
        'This is a community created for end-to-end testing, it will be deleted after the tests are done.',
    },
  });
}

export async function getTestCommunities() {
  const {data: allCommunities} =
    await clerkClient.organizations.getOrganizationList({limit: 1000});

  return allCommunities.filter(c => c.name.includes('End-2-end Community'));
}

export async function deleteUser(userId: string) {
  return clerkClient.users.deleteUser(userId);
}

export async function deleteCommunity(communityId: string) {
  await resetDb(communityId);
  return clerkClient.organizations.deleteOrganization(communityId);
}

export async function deleteCommunityWithData(communityId: string) {
  const {data: memberships} =
    await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: communityId,
    });
  await Promise.all(
    memberships.map(m => {
      if (m.publicUserData?.firstName === 'End-to-end') {
        clerkClient.users.deleteUser(m.publicUserData.userId);
      }
    })
  );
  await resetDb(communityId);
  return clerkClient.organizations.deleteOrganization(communityId);
}
