import {objectLists, objectItems} from './db/schema';
import {insertObjectItemSchema, insertObjectListSchema} from './db/validation';
import {sql} from 'drizzle-orm';
import {db} from './db/connection';
import {iriToHash} from './iri-to-hash';
import {DBQueryConfig, eq} from 'drizzle-orm';
import {ObjectList} from './db/types';

interface Option {
  withObjects?: boolean;
  limitObjects?: number;
  objectIri?: string;
}

export async function getByCommunityId(
  communityId: string,
  {withObjects, limitObjects, objectIri}: Option = {withObjects: false}
  // Explicitly set the return type, or else `objects` will not be included.
): Promise<ObjectList[]> {
  const options: DBQueryConfig = {};

  if (withObjects) {
    options.with = {
      objects: limitObjects ? {limit: limitObjects} : true,
    };
  }

  if (objectIri) {
    const objectId = iriToHash(objectIri);
    options.with = {
      objects: {
        where: (objectItems, {eq}) => eq(objectItems.objectId, objectId),
      },
    };
  }

  return db.query.objectLists.findMany({
    ...options,
    where: (objectLists, {eq}) => eq(objectLists.communityId, communityId),
  });
}

export async function find(id: number) {
  return db.query.objectLists.findFirst({
    where: (objectLists, {eq}) => eq(objectLists.id, id),
    with: {
      objects: true,
    },
  });
}

export async function countByCommunityId(communityId: string) {
  const result = await db
    // Postgres returns count(*) as bigint, which the driver hands over as a
    // string; cast to int and map to a JS number.
    .select({count: sql<number>`count(*)::int`.mapWith(Number)})
    .from(objectLists)
    .where(eq(objectLists.communityId, communityId));

  // We assume that the aggregations with `count` always returns an array with one value that is an object with the count prop
  return result[0].count;
}

interface CreateProps {
  communityId: string;
  name: string;
  createdBy: string;
  description?: string;
}

export async function create({
  communityId,
  name,
  createdBy,
  description,
}: CreateProps) {
  const objectList = insertObjectListSchema.parse({
    communityId,
    name,
    description,
    createdBy,
  });

  // Postgres has no insertId; return the new row's id explicitly.
  return db
    .insert(objectLists)
    .values(objectList)
    .returning({id: objectLists.id});
}

interface UpdateProps {
  id: number;
  communityId: string;
  name: string;
  createdBy: string;
  description?: string;
}

export async function update({
  id,
  communityId,
  name,
  createdBy,
  description,
}: UpdateProps) {
  const objectList = insertObjectListSchema.parse({
    communityId,
    name,
    description,
    createdBy,
  });

  return db.update(objectLists).set(objectList).where(eq(objectLists.id, id));
}

interface AddObjectProps {
  objectListId: number;
  objectIri: string;
  createdBy: string;
}

export async function addObject({
  objectListId,
  objectIri,
  createdBy,
}: AddObjectProps) {
  const objectItem = insertObjectItemSchema.parse({
    objectListId,
    objectIri,
    createdBy,
    objectId: iriToHash(objectIri),
  });

  return db.insert(objectItems).values(objectItem);
}

export async function deleteObject(id: number) {
  return db.delete(objectItems).where(eq(objectItems.id, id));
}

export async function deleteList(id: number) {
  // The FK object_item.object_list_id is ON DELETE CASCADE, so deleting the
  // list removes its items; the explicit item delete is kept as belt-and-braces.
  return db.transaction(async tx => {
    await tx.delete(objectItems).where(eq(objectItems.objectListId, id));
    await tx.delete(objectLists).where(eq(objectLists.id, id));
  });
}
