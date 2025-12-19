<template>
  <section>
    <base-card>
      <the-breadcrumb :crumbs="[
        { label: 'Gaming Groups', to: '/gaming-groups' },
        { label: isEdit ? 'Edit Gaming Group' : 'Add Gaming Group' }
      ]"></the-breadcrumb>
      <h2>{{ isEdit ? 'Edit' : 'Add' }} Gaming Group</h2>
      <gaming-group-form
        :is-edit="isEdit"
        :group-data="groupData"
        @save-data="saveData"
      ></gaming-group-form>
    </base-card>
  </section>
</template>

<script>
import GamingGroupForm from '../../components/gaming-groups/GamingGroupForm.vue';
import TheBreadcrumb from '../../components/ui/TheBreadcrumb.vue';

export default {
  components: {
    GamingGroupForm,
    TheBreadcrumb
  },
  data() {
    return {
      groupData: null,
      isEdit: false,
    };
  },
  async created() {
    const groupId = this.$route.params.id;
    if (groupId) {
      this.isEdit = true;
      try {
        await this.$store.dispatch('gamingGroups/loadGroups');
        const group = this.$store.getters['gamingGroups/groups'].find(g => g.id === parseInt(groupId));
        if (group) {
          this.groupData = { ...group };
        } else {
          this.$router.replace('/gaming-groups');
        }
      } catch (error) {
        this.$router.replace('/gaming-groups');
      }
    }
  },
  methods: {
    async saveData(data) {
      try {
        if (this.isEdit) {
          await this.$store.dispatch('gamingGroups/updateGroup', {
            id: this.$route.params.id,
            ...data
          });
        } else {
          await this.$store.dispatch('gamingGroups/addGroup', data);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.$router.replace('/gaming-groups');
      } catch (error) {
        console.error('Error saving group:', error);
      }
    }
  }
};
</script>
