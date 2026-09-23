'use server';

import {objectList} from '@p-322/database';
import {revalidatePath} from 'next/cache';

interface Props {
  id: number;
  revalidatePathName: string;
}

export async function deleteObjectFromList({id, revalidatePathName}: Props) {
  await objectList.deleteObject(id);
  revalidatePath(`/[locale]${revalidatePathName}`, 'page');
}

export async function deleteList({id, revalidatePathName}: Props) {
  await objectList.deleteList(id);
  revalidatePath(`/[locale]${revalidatePathName}`, 'page');
}
